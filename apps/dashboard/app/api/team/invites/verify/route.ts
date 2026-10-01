import { NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { teamInvites, user } from "@/lib/db/schema";
import { badRequest, notFound, apiError } from "@/lib/api/errors";

/**
 * GET /api/team/invites/verify?token=...
 * Verifies if an invite token is valid and unexpired, and returns details.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  if (!token) {
    return badRequest("Invite token is required");
  }

  try {
    const [invite] = await db
      .select({
        id: teamInvites.id,
        email: teamInvites.email,
        role: teamInvites.role,
        expiresAt: teamInvites.expiresAt,
        teamOwnerId: teamInvites.teamOwnerId,
      })
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.token, token),
          gt(teamInvites.expiresAt, new Date())
        )
      );

    if (!invite) {
      return notFound("Invalid or expired invitation link");
    }

    const [owner] = await db
      .select({
        name: user.name,
        email: user.email,
      })
      .from(user)
      .where(eq(user.id, invite.teamOwnerId));

    return NextResponse.json({
      valid: true,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        inviterName: owner?.name || "A team owner",
        inviterEmail: owner?.email || "",
      },
    });
  } catch (error) {
    console.error("Failed to verify invite token:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to verify invitation");
  }
}
