import { NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { teamInvites, teamMembers } from "@/lib/db/schema";
import { apiError, badRequest, notFound, unauthorized } from "@/lib/api/errors";
import { acceptInviteSchema } from "@/lib/validations/team";
import { createNotification } from "@/lib/notifications/service";
import { log } from "@/lib/log";

/**
 * POST /api/team/invites/accept
 * Accepts an invitation token for the currently authenticated user.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("You must be logged in to accept an invitation");
  }

  try {
    const body = await request.json();
    const validated = acceptInviteSchema.safeParse(body);

    if (!validated.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: validated.error.flatten().fieldErrors,
      });
    }

    const { token } = validated.data;

    // 1. Find valid invite
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.token, token),
          gt(teamInvites.expiresAt, new Date())
        )
      );

    if (!invite) {
      return notFound("Invalid or expired invitation token");
    }

    // 2. Prevent team owner from accepting their own invite
    if (invite.teamOwnerId === session.user.id) {
      return badRequest("You are the owner of this team and cannot accept your own invitation.");
    }

    // 3. Add or update membership in teamMembers
    const [existingMembership] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamOwnerId, invite.teamOwnerId),
          eq(teamMembers.userId, session.user.id)
        )
      );

    let memberRecord;
    if (existingMembership) {
      const [updated] = await db
        .update(teamMembers)
        .set({
          role: invite.role,
          acceptedAt: new Date(),
        })
        .where(eq(teamMembers.id, existingMembership.id))
        .returning();
      memberRecord = updated;
    } else {
      const [inserted] = await db
        .insert(teamMembers)
        .values({
          teamOwnerId: invite.teamOwnerId,
          userId: session.user.id,
          role: invite.role,
          acceptedAt: new Date(),
        })
        .returning();
      memberRecord = inserted;
    }

    // 4. Remove the consumed invite
    await db.delete(teamInvites).where(eq(teamInvites.id, invite.id));

    void createNotification({
      userId: invite.teamOwnerId,
      type: "team.invite_accepted",
      title: `${session.user.name || session.user.email} joined your team`,
      body: `They now have ${invite.role} access.`,
      href: "/settings/team",
    });

    return NextResponse.json({
      success: true,
      membership: memberRecord,
    });
  } catch (error) {
    log.error("Failed to accept team invite:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to accept team invitation");
  }
}
