import { NextResponse } from "next/server";
import { eq, and, isNotNull } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { teamMembers, user } from "@/lib/db/schema";
import { apiError, unauthorized } from "@/lib/api/errors";

export interface TeamMemberItem {
  id: string; // team_members.id or "owner"
  userId: string;
  name: string;
  email: string;
  image?: string | null;
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
  isOwner: boolean;
}

/**
 * GET /api/team/members
 * Returns all active members belonging to the current user's team workspace.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    // 1. Fetch the team owner record
    const [ownerRecord] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, session.user.id));

    // 2. Fetch all accepted team members where current user is the owner
    const members = await db
      .select({
        id: teamMembers.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: teamMembers.role,
        joinedAt: teamMembers.acceptedAt,
      })
      .from(teamMembers)
      .innerJoin(user, eq(teamMembers.userId, user.id))
      .where(
        and(
          eq(teamMembers.teamOwnerId, session.user.id),
          isNotNull(teamMembers.acceptedAt)
        )
      );

    const memberList: TeamMemberItem[] = [
      {
        id: "owner",
        userId: ownerRecord ? ownerRecord.id : session.user.id,
        name: ownerRecord?.name || session.user.name || "Account Owner",
        email: ownerRecord?.email || session.user.email || "",
        image: ownerRecord?.image,
        role: "owner",
        joinedAt: ownerRecord ? ownerRecord.createdAt.toISOString() : new Date().toISOString(),
        isOwner: true,
      },
      ...members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.name,
        email: m.email,
        image: m.image,
        role: m.role as "owner" | "editor" | "viewer",
        joinedAt: m.joinedAt ? m.joinedAt.toISOString() : new Date().toISOString(),
        isOwner: false,
      })),
    ];

    return NextResponse.json({
      members: memberList,
      currentUserId: session.user.id,
    });
  } catch (error) {
    console.error("Failed to list team members:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to list team members");
  }
}
