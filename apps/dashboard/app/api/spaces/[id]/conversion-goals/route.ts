import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { conversionGoals, spaces } from "@/lib/db/schema";
import { createConversionGoalSchema } from "@/lib/validations/conversion-goals";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getOwnedSpace(spaceId: string, userId: string) {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId));
  if (!space) {
    return {
      error: { code: "NOT_FOUND" as const, message: "Space not found" },
      status: 404 as const,
    };
  }
  if (space.ownerId !== userId) {
    return {
      error: {
        code: "FORBIDDEN" as const,
        message: "Forbidden: You do not own this space",
      },
      status: 403 as const,
    };
  }
  return { space };
}

/**
 * GET /api/spaces/[id]/conversion-goals
 * Lists conversion goals for the space.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;

  try {
    const owned = await getOwnedSpace(id, session.user.id);
    if (owned.error) {
      return apiError(owned.status, owned.error.code, owned.error.message);
    }

    const goals = await db
      .select()
      .from(conversionGoals)
      .where(eq(conversionGoals.spaceId, id))
      .orderBy(asc(conversionGoals.createdAt));

    return NextResponse.json({ goals });
  } catch (error) {
    console.error("Failed to fetch conversion goals:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch conversion goals");
  }
}

/**
 * POST /api/spaces/[id]/conversion-goals
 * Creates a conversion goal (url-match or pixel).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;

  try {
    const owned = await getOwnedSpace(id, session.user.id);
    if (owned.error) {
      return apiError(owned.status, owned.error.code, owned.error.message);
    }

    const body = await request.json();
    const validated = createConversionGoalSchema.safeParse(body);

    if (!validated.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: validated.error.flatten().fieldErrors,
      });
    }

    const [goal] = await db
      .insert(conversionGoals)
      .values({
        spaceId: id,
        goalType: validated.data.goalType,
        goalValue: validated.data.goalValue,
      })
      .returning();

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    console.error("Failed to create conversion goal:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to create conversion goal");
  }
}

/**
 * DELETE /api/spaces/[id]/conversion-goals?goalId=...
 * Removes a conversion goal belonging to the space.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;
  const goalId = new URL(request.url).searchParams.get("goalId");

  if (!goalId) {
    return apiError(400, "BAD_REQUEST", "goalId query parameter is required");
  }

  try {
    const owned = await getOwnedSpace(id, session.user.id);
    if (owned.error) {
      return apiError(owned.status, owned.error.code, owned.error.message);
    }

    const deleted = await db
      .delete(conversionGoals)
      .where(
        and(eq(conversionGoals.id, goalId), eq(conversionGoals.spaceId, id))
      )
      .returning({ id: conversionGoals.id });

    if (deleted.length === 0) {
      return apiError(404, "NOT_FOUND", "Goal not found");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete conversion goal:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to delete conversion goal");
  }
}
