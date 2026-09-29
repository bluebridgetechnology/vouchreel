import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
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
    return { error: "Space not found", status: 404 as const };
  }
  if (space.ownerId !== userId) {
    return { error: "Forbidden: You do not own this space", status: 403 as const };
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const owned = await getOwnedSpace(id, session.user.id);
    if ("error" in owned) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }

    const goals = await db
      .select()
      .from(conversionGoals)
      .where(eq(conversionGoals.spaceId, id))
      .orderBy(asc(conversionGoals.createdAt));

    return NextResponse.json({ goals });
  } catch (error) {
    console.error("Failed to fetch conversion goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversion goals" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/spaces/[id]/conversion-goals
 * Creates a conversion goal (url-match or pixel).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const owned = await getOwnedSpace(id, session.user.id);
    if ("error" in owned) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }

    const body = await request.json();
    const validated = createConversionGoalSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
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
    return NextResponse.json(
      { error: "Failed to create conversion goal" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/spaces/[id]/conversion-goals?goalId=...
 * Removes a conversion goal belonging to the space.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const goalId = new URL(request.url).searchParams.get("goalId");

  if (!goalId) {
    return NextResponse.json(
      { error: "goalId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const owned = await getOwnedSpace(id, session.user.id);
    if ("error" in owned) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }

    const deleted = await db
      .delete(conversionGoals)
      .where(
        and(eq(conversionGoals.id, goalId), eq(conversionGoals.spaceId, id))
      )
      .returning({ id: conversionGoals.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete conversion goal:", error);
    return NextResponse.json(
      { error: "Failed to delete conversion goal" },
      { status: 500 }
    );
  }
}
