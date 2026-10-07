import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import {
  badRequest,
  forbidden,
  internalError,
  notFound,
  unauthorized,
  validationError,
} from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, reviews } from "@/lib/db/schema";
import { updateReviewSchema } from "@/lib/validations/reviews";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string; reviewId: string }>;
}

/**
 * PATCH /api/spaces/[id]/reviews/[reviewId]
 * Updates review moderation status (approve / hide).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId, reviewId } = await params;

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

    const body = await request.json();
    const validated = updateReviewSchema.safeParse(body);

    if (!validated.success) {
      return validationError(
        "Validation failed",
        validated.error.flatten().fieldErrors
      );
    }

    const [review] = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.spaceId, spaceId)));

    if (!review) {
      return notFound("Review not found");
    }

    const [updated] = await db
      .update(reviews)
      .set({ isApproved: validated.data.isApproved })
      .where(eq(reviews.id, review.id))
      .returning();

    return NextResponse.json({ review: updated });
  } catch (error) {
    log.error("Failed to update review status:", error);
    return internalError("Failed to update review status");
  }
}

/**
 * DELETE /api/spaces/[id]/reviews/[reviewId]
 * Deletes an imported review.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId, reviewId } = await params;

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

    const [review] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.spaceId, spaceId)));

    if (!review) {
      return notFound("Review not found");
    }

    await db.delete(reviews).where(eq(reviews.id, reviewId));

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Failed to delete review:", error);
    return internalError("Failed to delete review");
  }
}
