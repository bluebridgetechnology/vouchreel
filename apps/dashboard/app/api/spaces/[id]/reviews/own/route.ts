import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { badRequest, forbidden, internalError, notFound, unauthorized, validationError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, reviews } from "@/lib/db/schema";
import { OWN_REVIEW_LIMIT_PER_SPACE, ownReviewSchema } from "@/lib/reviews/own";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/spaces/[id]/reviews/own
 * Adds a review the owner typed in (name, text, optional link). No provider, no rating.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  const { id: spaceId } = await params;

  try {
    const [space] = await db.select({ id: spaces.id, ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
    if (!space) return notFound("Space not found");
    if (space.ownerId !== session.user.id) return forbidden("Forbidden: You do not own this space");

    const limit = await rateLimit(`own_review:${session.user.id}`, { windowMs: 60 * 60 * 1000, max: 60 });
    if (!limit.success) return badRequest("Too many reviews added. Try again later.");

    const body = await request.json().catch(() => null);
    const validated = ownReviewSchema.safeParse(body);
    if (!validated.success) return validationError("Validation failed", validated.error.flatten().fieldErrors);

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(reviews)
      .where(and(eq(reviews.spaceId, spaceId), eq(reviews.provider, "own")));
    if (n >= OWN_REVIEW_LIMIT_PER_SPACE) return badRequest(`A space can hold up to ${OWN_REVIEW_LIMIT_PER_SPACE} reviews you add yourself.`);

    const id = crypto.randomUUID();
    const [created] = await db
      .insert(reviews)
      .values({
        id,
        spaceId,
        sourceId: null,
        provider: "own",
        authorName: validated.data.name,
        rating: null,
        text: validated.data.text,
        linkUrl: validated.data.link ?? null,
        // No date: the owner's words carry none we could vouch for, and none is shown with the review
        reviewDate: null,
        providerReviewId: `own:${id}`,
        isApproved: true,
      })
      .returning();
    return NextResponse.json({ review: created }, { status: 201 });
  } catch (error) {
    log.error("Failed to add own review:", error);
    return internalError("Failed to add review");
  }
}
