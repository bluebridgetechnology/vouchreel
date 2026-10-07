import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { forbidden, internalError, notFound, unauthorized, validationError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, reviews } from "@/lib/db/schema";
import { ownReviewSchema } from "@/lib/reviews/own";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string; reviewId: string }>;
}

/**
 * PUT /api/spaces/[id]/reviews/own/[reviewId]
 * Edits a review the owner typed in. Imported reviews cannot be edited (they are shown as written).
 * Videos already made keep the text they were made with.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  const { id: spaceId, reviewId } = await params;

  try {
    const [space] = await db.select({ id: spaces.id, ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
    if (!space) return notFound("Space not found");
    if (space.ownerId !== session.user.id) return forbidden("Forbidden: You do not own this space");

    const body = await request.json().catch(() => null);
    const validated = ownReviewSchema.safeParse(body);
    if (!validated.success) return validationError("Validation failed", validated.error.flatten().fieldErrors);

    const [updated] = await db
      .update(reviews)
      .set({ authorName: validated.data.name, text: validated.data.text, linkUrl: validated.data.link ?? null })
      .where(and(eq(reviews.id, reviewId), eq(reviews.spaceId, spaceId), eq(reviews.provider, "own")))
      .returning();
    if (!updated) return notFound("Review not found");
    return NextResponse.json({ review: updated });
  } catch (error) {
    log.error("Failed to edit own review:", error);
    return internalError("Failed to edit review");
  }
}
