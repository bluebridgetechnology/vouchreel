import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { teamInvites } from "@/lib/db/schema";
import { apiError, notFound, unauthorized } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/team/invites/[id]
 * Cancels a pending team invitation.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id } = await params;

  try {
    const [invite] = await db
      .select({ id: teamInvites.id, teamOwnerId: teamInvites.teamOwnerId })
      .from(teamInvites)
      .where(and(eq(teamInvites.id, id), eq(teamInvites.teamOwnerId, session.user.id)));

    if (!invite) {
      return notFound("Invitation not found");
    }

    await db.delete(teamInvites).where(eq(teamInvites.id, id));

    return NextResponse.json({ success: true, message: "Invitation cancelled" });
  } catch (error) {
    console.error("Failed to cancel team invite:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to cancel team invitation");
  }
}
