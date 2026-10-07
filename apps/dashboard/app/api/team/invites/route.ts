import { NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { teamInvites, teamMembers, user } from "@/lib/db/schema";
import { apiError, badRequest, forbidden, unauthorized } from "@/lib/api/errors";
import { createInviteSchema } from "@/lib/validations/team";
import { canAccess } from "@/lib/auth/feature-gate";
import { createInviteToken, sendTeamInviteEmail } from "@/lib/email/invite";
import { log } from "@/lib/log";

/**
 * GET /api/team/invites
 * Lists pending, unexpired invitations sent by the authenticated team owner.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const invites = await db
      .select({
        id: teamInvites.id,
        email: teamInvites.email,
        role: teamInvites.role,
        expiresAt: teamInvites.expiresAt,
        createdAt: teamInvites.createdAt,
      })
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.teamOwnerId, session.user.id),
          gt(teamInvites.expiresAt, new Date())
        )
      );

    return NextResponse.json({ invites });
  } catch (error) {
    log.error("Failed to list team invites:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to list team invites");
  }
}

/**
 * POST /api/team/invites
 * Invites a new team member by email with role assignment (editor or viewer).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  // 1. Feature Gate check: Multi-seat accounts require an Agency subscription
  const allowed = await canAccess(session.user.id, "multi-seat");
  if (!allowed) {
    return forbidden(
      "Multi-seat team accounts require an Agency plan. Please upgrade to invite team members."
    );
  }

  try {
    const body = await request.json();
    const validated = createInviteSchema.safeParse(body);

    if (!validated.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: validated.error.flatten().fieldErrors,
      });
    }

    const targetEmail = validated.data.email.toLowerCase().trim();
    const role = validated.data.role;

    // 2. Prevent self-invite
    if (session.user.email?.toLowerCase() === targetEmail) {
      return badRequest("You cannot invite yourself to your own team.");
    }

    // 3. Check if target user is already a team member
    const [existingMemberUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, targetEmail));

    if (existingMemberUser) {
      const [existingMembership] = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamOwnerId, session.user.id),
            eq(teamMembers.userId, existingMemberUser.id)
          )
        );

      if (existingMembership) {
        return badRequest("This user is already an active member of your team.");
      }
    }

    // 4. Generate token and expiry
    const { token, expiresAt } = createInviteToken();

    // 5. Check if an invite already exists for this email
    const [existingInvite] = await db
      .select({ id: teamInvites.id })
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.teamOwnerId, session.user.id),
          eq(teamInvites.email, targetEmail)
        )
      );

    let savedInvite;
    if (existingInvite) {
      const [updated] = await db
        .update(teamInvites)
        .set({
          role,
          token,
          expiresAt,
        })
        .where(eq(teamInvites.id, existingInvite.id))
        .returning();
      savedInvite = updated;
    } else {
      const [inserted] = await db
        .insert(teamInvites)
        .values({
          teamOwnerId: session.user.id,
          email: targetEmail,
          role,
          token,
          expiresAt,
        })
        .returning();
      savedInvite = inserted;
    }

    // 6. Send invitation email
    const emailResult = await sendTeamInviteEmail({
      toEmail: targetEmail,
      inviterName: session.user.name || "Your Team Owner",
      inviterEmail: session.user.email,
      role,
      token,
    });

    return NextResponse.json(
      {
        invite: {
          id: savedInvite.id,
          email: savedInvite.email,
          role: savedInvite.role,
          expiresAt: savedInvite.expiresAt,
          createdAt: savedInvite.createdAt,
        },
        inviteUrl: emailResult.inviteUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    log.error("Failed to create team invite:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to send team invitation");
  }
}
