import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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
import { getExperimentsWithStats } from "@/lib/experiments/queries";
import { createExperimentSchema } from "@/lib/validations/experiments";

interface RouteParams {
  params: Promise<{ id: string }>;
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
 * GET /api/spaces/[id]/experiments
 * Lists all experiments for the space, including per-variant metrics.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId } = await params;

  try {
    const access = await verifySpaceAccess(spaceId, session.user.id);
    if (access.notFound) return notFound("Space not found");
    if (access.forbidden) return forbidden("Forbidden: You do not own this space");

    const experimentsList = await getExperimentsWithStats(spaceId);

    return NextResponse.json({
      experiments: experimentsList,
    });
  } catch (error) {
    console.error("Failed to list experiments:", error);
    return internalError("Failed to fetch experiments");
  }
}

/**
 * POST /api/spaces/[id]/experiments
 * Creates a new A/B testing experiment in draft status.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId } = await params;

  try {
    const access = await verifySpaceAccess(spaceId, session.user.id);
    if (access.notFound) return notFound("Space not found");
    if (access.forbidden) return forbidden("Forbidden: You do not own this space");

    const body = await request.json();
    const validated = createExperimentSchema.safeParse(body);

    if (!validated.success) {
      return validationError(
        "Validation failed",
        validated.error.flatten().fieldErrors
      );
    }

    const { name, type, variants, trafficSplit } = validated.data;

    const [created] = await db
      .insert(experiments)
      .values({
        spaceId,
        name,
        type,
        variants,
        trafficSplit,
        status: "draft",
      })
      .returning();

    return NextResponse.json({ experiment: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create experiment:", error);
    return internalError("Failed to create experiment");
  }
}
