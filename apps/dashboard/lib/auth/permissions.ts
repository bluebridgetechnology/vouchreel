import { eq, and, isNotNull, inArray, count, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces, teamMembers, testimonials } from "@/lib/db/schema";
import { forbidden, notFound } from "@/lib/api/errors";
import { NextResponse } from "next/server";

export type TeamRole = "owner" | "editor" | "viewer";

const ROLE_LEVELS: Record<TeamRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

/**
 * Checks whether userRole meets or exceeds the requiredRole in the hierarchy.
 * owner (3) > editor (2) > viewer (1)
 */
export function hasRolePermission(userRole: TeamRole, requiredRole: TeamRole): boolean {
  const userLevel = ROLE_LEVELS[userRole] ?? 0;
  const requiredLevel = ROLE_LEVELS[requiredRole] ?? 999;
  return userLevel >= requiredLevel;
}

export interface SpaceAccessResult {
  space: typeof spaces.$inferSelect;
  role: TeamRole;
  isDirectOwner: boolean;
}

/**
 * Resolves whether a user has access to a space, either as the direct space owner
 * or through an accepted team membership with the space owner.
 */
export async function getSpaceAccess(
  userId: string,
  spaceId: string
): Promise<SpaceAccessResult | null> {
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId));

  if (!space) {
    return null;
  }

  // 1. Direct owner
  if (space.ownerId === userId) {
    return {
      space,
      role: "owner",
      isDirectOwner: true,
    };
  }

  // 2. Team membership with the space owner
  const [membership] = await db
    .select({
      role: teamMembers.role,
    })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamOwnerId, space.ownerId),
        eq(teamMembers.userId, userId),
        isNotNull(teamMembers.acceptedAt)
      )
    );

  if (!membership || !membership.role) {
    return null;
  }

  return {
    space,
    role: membership.role as TeamRole,
    isDirectOwner: false,
  };
}

export type VerifySpaceAccessResult =
  | { success: true; access: SpaceAccessResult; errorResponse?: never }
  | { success: false; access?: never; errorResponse: NextResponse };

/**
 * Verifies that a user can access a space with at least the required role.
 * Returns either the authorized access result or a ready-to-return NextResponse error.
 */
export async function verifySpaceAccess(
  userId: string,
  spaceId: string,
  minRole: TeamRole = "viewer"
): Promise<VerifySpaceAccessResult> {
  const access = await getSpaceAccess(userId, spaceId);

  if (!access) {
    // Check if space exists at all to return 404 vs 403
    const [existingSpace] = await db
      .select({ id: spaces.id })
      .from(spaces)
      .where(eq(spaces.id, spaceId));

    if (!existingSpace) {
      return { success: false, errorResponse: notFound("Space not found") };
    }
    return { success: false, errorResponse: forbidden("You do not have access to this space") };
  }

  if (!hasRolePermission(access.role, minRole)) {
    return {
      success: false,
      errorResponse: forbidden(
        `Forbidden: '${access.role}' role lacks permission. Minimum '${minRole}' role required.`
      ),
    };
  }

  return { success: true, access };
}

export interface AccessibleSpaceItem {
  id: string;
  name: string;
  ownerId: string;
  embedKey: string;
  createdAt: string;
  testimonialCount: number;
  role: TeamRole;
  isDirectOwner: boolean;
}

/**
 * Fetches all spaces accessible to a user (both directly owned and shared via team membership).
 */
export async function getAccessibleSpacesWithCounts(
  userId: string
): Promise<AccessibleSpaceItem[]> {
  // 1. Get directly owned spaces
  const ownedSpaces = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      ownerId: spaces.ownerId,
      embedKey: spaces.embedKey,
      createdAt: spaces.createdAt,
    })
    .from(spaces)
    .where(eq(spaces.ownerId, userId))
    .orderBy(desc(spaces.createdAt));

  // 2. Get team memberships
  let memberships: Array<{ teamOwnerId: string; role: string }> = [];
  try {
    const rawMemberships = await db
      .select({
        teamOwnerId: teamMembers.teamOwnerId,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), isNotNull(teamMembers.acceptedAt)));

    if (Array.isArray(rawMemberships)) {
      memberships = rawMemberships.filter(
        (m) => typeof m?.teamOwnerId === "string" && m.teamOwnerId.length > 0
      );
    }
  } catch {
    memberships = [];
  }

  let teamSpaces: Array<{
    id: string;
    name: string;
    ownerId: string;
    embedKey: string;
    createdAt: Date;
    role: TeamRole;
  }> = [];

  if (memberships.length > 0) {
    const ownerIds = memberships.map((m) => m.teamOwnerId);
    const roleMap = new Map<string, TeamRole>(
      memberships.map((m) => [m.teamOwnerId, m.role as TeamRole])
    );

    const query = db
      .select({
        id: spaces.id,
        name: spaces.name,
        ownerId: spaces.ownerId,
        embedKey: spaces.embedKey,
        createdAt: spaces.createdAt,
      })
      .from(spaces)
      .where(inArray(spaces.ownerId, ownerIds));

    const rawTeamSpaces = typeof (query as any)?.orderBy === "function"
      ? await (query as any).orderBy(desc(spaces.createdAt))
      : await query;

    if (Array.isArray(rawTeamSpaces)) {
      teamSpaces = rawTeamSpaces
        .filter((s) => !!s && typeof s.id === "string")
        .map((s) => ({
          ...s,
          role: roleMap.get(s.ownerId) || "viewer",
        }));
    }
  }

  // Combine and deduplicate
  const combined = [
    ...ownedSpaces.map((s) => ({ ...s, role: "owner" as TeamRole, isDirectOwner: true })),
    ...teamSpaces.map((s) => ({ ...s, isDirectOwner: false })),
  ];

  return Promise.all(
    combined.map(async (space) => {
      const [testimonialCount] = await db
        .select({ value: count() })
        .from(testimonials)
        .where(eq(testimonials.spaceId, space.id));

      return {
        ...space,
        createdAt: space.createdAt instanceof Date ? space.createdAt.toISOString() : String(space.createdAt),
        testimonialCount: testimonialCount?.value ?? 0,
      };
    })
  );
}
