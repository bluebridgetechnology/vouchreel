import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { teamInvites } from "@/lib/db/schema";
import { apiError, notFound, unauthorized } from "@/lib/api/errors";
import { createInviteToken, sendTeamInviteEmail } from "@/lib/email/invite";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/team/invites/[id]/resend
 * Refreshes token & expiry, and resends the invitation email.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id } = await params;

  try {
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(and(eq(teamInvites.id, id), eq(teamInvites.teamOwnerId, session.user.id)));

    if (!invite) {
      return notFound("Invitation not found");
    }

    const { token, expiresAt } = createInviteToken();

    const [updatedInvite] = await db
      .update(teamInvites)
      .set({
        token,
        expiresAt,
      })
      .where(eq(teamInvites.id, id))
      .returning();

    const emailResult = await sendTeamInviteEmail({
      toEmail: updatedInvite.email,
      inviterName: session.user.name || "Your Team Owner",
      inviterEmail: session.user.email,
      role: updatedInvite.role,
      token,
    });

    return NextResponse.json({
      success: true,
      invite: updatedInvite,
      inviteUrl: emailResult.inviteUrl,
    });
  } catch (error) {
    log.error("Failed to resend team invite:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to resend team invitation");
  }
}
