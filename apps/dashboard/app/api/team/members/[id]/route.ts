import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { teamMembers } from "@/lib/db/schema";
import { apiError, badRequest, forbidden, notFound, unauthorized } from "@/lib/api/errors";
import { updateMemberRoleSchema } from "@/lib/validations/team";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/team/members/[id]
 * Updates a member's role (editor <-> viewer). Must be team owner.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id } = await params;

  if (id === "owner") {
    return badRequest("Cannot change the account owner's role.");
  }

  try {
    const body = await request.json();
    const validated = updateMemberRoleSchema.safeParse(body);

    if (!validated.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: validated.error.flatten().fieldErrors,
      });
    }

    const { role } = validated.data;
    if (role === "owner") {
      return badRequest("Cannot assign owner role to a team member.");
    }

    // Verify member exists and current user is the team owner
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, id), eq(teamMembers.teamOwnerId, session.user.id)));

    if (!member) {
      return notFound("Team member not found or you are not authorized to manage this team");
    }

    const [updated] = await db
      .update(teamMembers)
      .set({ role })
      .where(eq(teamMembers.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      member: updated,
    });
  } catch (error) {
    log.error("Failed to update team member role:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to update team member role");
  }
}

/**
 * DELETE /api/team/members/[id]
 * Removes a member from the team.
 * Allowed if current user is the team owner OR the member themselves leaving the team.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id } = await params;

  if (id === "owner") {
    return badRequest("Cannot remove the primary account owner from the team.");
  }

  try {
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, id));

    if (!member) {
      return notFound("Team member not found");
    }

    const isOwner = member.teamOwnerId === session.user.id;
    const isSelf = member.userId === session.user.id;

    if (!isOwner && !isSelf) {
      return forbidden("You do not have permission to remove this member.");
    }

    await db.delete(teamMembers).where(eq(teamMembers.id, id));

    return NextResponse.json({
      success: true,
      message: isSelf ? "You have left the team" : "Member removed from team",
    });
  } catch (error) {
    log.error("Failed to delete team member:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to remove team member");
  }
}
