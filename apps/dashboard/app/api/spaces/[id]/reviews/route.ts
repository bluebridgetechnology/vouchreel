import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { unauthorized, forbidden, notFound, internalError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, reviews, reviewSources } from "@/lib/db/schema";
import { googleOAuthConfig } from "@/lib/reviews/google-oauth";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/spaces/[id]/reviews
 * Lists all imported reviews and connected review sources for a space.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId } = await params;

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

    const spaceReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.spaceId, spaceId))
      .orderBy(desc(reviews.reviewDate), desc(reviews.createdAt));

    const sources = await db
      .select({
        id: reviewSources.id,
        provider: reviewSources.provider,
        providerBusinessId: reviewSources.providerBusinessId,
        lastSyncAt: reviewSources.lastSyncAt,
        isActive: reviewSources.isActive,
        authKind: reviewSources.authKind,
        displayName: reviewSources.displayName,
        lastError: reviewSources.lastError,
        createdAt: reviewSources.createdAt,
      })
      .from(reviewSources)
      .where(eq(reviewSources.spaceId, spaceId));

    return NextResponse.json({
      reviews: spaceReviews,
      sources,
      // Whether this installation lets owners sign in with Google (its OAuth app is set up)
      googleOAuthAvailable: googleOAuthConfig() !== null,
    });
  } catch (error) {
    log.error("Failed to list reviews:", error);
    return internalError("Failed to fetch reviews");
  }
}
