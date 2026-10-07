import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import {
  unauthorized,
  forbidden,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { experiments, spaces } from "@/lib/db/schema";
import { getExperimentMetrics } from "@/lib/experiments/queries";
import { updateExperimentStatusSchema } from "@/lib/validations/experiments";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string; expId: string }>;
}

async function verifySpaceAccess(spaceId: string, userId: string) {
  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, spaceId));

  if (!space) {
    return { notFound: true };
  }

  if (space.ownerId !== userId) {
    return { forbidden: true };
  }

  return { space };
}

/**
 * GET /api/spaces/[id]/experiments/[expId]
 * Retrieves a single experiment with detailed per-variant stats and statistical significance.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId, expId } = await params;

  try {
    const access = await verifySpaceAccess(spaceId, session.user.id);
    if (access.notFound) return notFound("Space not found");
    if (access.forbidden) return forbidden("Forbidden: You do not own this space");

    const [experiment] = await db
      .select()
      .from(experiments)
      .where(and(eq(experiments.id, expId), eq(experiments.spaceId, spaceId)));

    if (!experiment) {
      return notFound("Experiment not found");
    }

    const { variants, totals } = await getExperimentMetrics(
      spaceId,
      experiment.id,
      experiment.variants || [],
      experiment.trafficSplit || []
    );

    const overallConversionRate =
      totals.impressions > 0
        ? Math.round((totals.conversions / totals.impressions) * 10000) / 100
        : 0;

    return NextResponse.json({
      experiment: {
        ...experiment,
        variants,
        totalImpressions: totals.impressions,
        totalPlays: totals.plays,
        totalClicks: totals.clicks,
        totalConversions: totals.conversions,
        overallConversionRate,
      },
    });
  } catch (error) {
    log.error("Failed to fetch experiment:", error);
    return internalError("Failed to fetch experiment");
  }
}

/**
 * PATCH /api/spaces/[id]/experiments/[expId]
 * Updates experiment status ('draft' | 'running' | 'completed').
 * Sets startedAt when starting and endedAt when completing.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId, expId } = await params;

  try {
    const access = await verifySpaceAccess(spaceId, session.user.id);
    if (access.notFound) return notFound("Space not found");
    if (access.forbidden) return forbidden("Forbidden: You do not own this space");

    const [existing] = await db
      .select()
      .from(experiments)
      .where(and(eq(experiments.id, expId), eq(experiments.spaceId, spaceId)));

    if (!existing) {
      return notFound("Experiment not found");
    }

    const body = await request.json();
    const validated = updateExperimentStatusSchema.safeParse(body);

    if (!validated.success) {
      return validationError(
        "Validation failed",
        validated.error.flatten().fieldErrors
      );
    }

    const targetStatus = validated.data.status;
    const updateValues: Partial<typeof experiments.$inferInsert> = {
      status: targetStatus,
    };

    if (targetStatus === "running") {
      updateValues.startedAt = new Date();
      updateValues.endedAt = null;
    } else if (targetStatus === "completed") {
      updateValues.endedAt = new Date();
    } else if (targetStatus === "draft") {
      updateValues.startedAt = null;
      updateValues.endedAt = null;
    }

    const [updated] = await db
      .update(experiments)
      .set(updateValues)
      .where(and(eq(experiments.id, expId), eq(experiments.spaceId, spaceId)))
      .returning();

    return NextResponse.json({ experiment: updated });
  } catch (error) {
    log.error("Failed to update experiment status:", error);
    return internalError("Failed to update experiment status");
  }
}

/**
 * DELETE /api/spaces/[id]/experiments/[expId]
 * Deletes an experiment.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId, expId } = await params;

  try {
    const access = await verifySpaceAccess(spaceId, session.user.id);
    if (access.notFound) return notFound("Space not found");
    if (access.forbidden) return forbidden("Forbidden: You do not own this space");

    const [deleted] = await db
      .delete(experiments)
      .where(and(eq(experiments.id, expId), eq(experiments.spaceId, spaceId)))
      .returning({ id: experiments.id });

    if (!deleted) {
      return notFound("Experiment not found");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Failed to delete experiment:", error);
    return internalError("Failed to delete experiment");
  }
}
