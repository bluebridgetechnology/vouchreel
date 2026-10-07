import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { badRequest, forbidden, internalError, notFound, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, reviewSources } from "@/lib/db/schema";
import { syncReviewSource } from "@/lib/reviews/sync";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string; sourceId: string }>;
}

/**
 * POST /api/spaces/[id]/reviews/sources/[sourceId]/sync
 * Triggers a manual sync for a review source.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId, sourceId } = await params;

  try {
    const [space] = await db
      .select({ id: spaces.id, ownerId: spaces.ownerId })
      .from(spaces)
      .where(eq(spaces.id, spaceId));

    if (!space) {
      return notFound("Space not found");
    }

    if (space.ownerId !== session.user.id) {
      return forbidden("Forbidden: You do not own this space");
    }

    const [source] = await db
      .select()
      .from(reviewSources)
      .where(
        and(eq(reviewSources.id, sourceId), eq(reviewSources.spaceId, spaceId))
      );

    if (!source) {
      return notFound("Review source not found");
    }

    let force = false;
    try {
      const body = await request.json();
      if (body && typeof body.force === "boolean") {
        force = body.force;
      }
    } catch {
      // Body is optional
    }

    const syncResult = await syncReviewSource(source.id, { force });

    return NextResponse.json({
      success: true,
      syncResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    if (message.includes("Rate limit cooldown")) {
      return badRequest(message);
    }
    log.error("Failed to sync review source:", error);
    return internalError(message);
  }
}
