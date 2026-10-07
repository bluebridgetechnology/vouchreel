import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { aiVideoErrorResponse, requireSpaceOwner } from "@/lib/ai-video/access";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";
import { getBrandKit } from "@/lib/brand-kit/service";
import {
  createReviewVideo,
  getReviewVideoCredits,
  listReviewOptions,
  listReviewVideos,
} from "@/lib/review-video/service";
import { createReviewVideoSchema } from "@/lib/validations/review-video";
import { TEMPLATES } from "@vouchreel/video";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Everything the "Review videos" panel needs: videos, reviews to pick from, templates, credits. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: spaceId } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  try {
    const [videos, options, credits, kit] = await Promise.all([
      listReviewVideos(spaceId),
      listReviewOptions(spaceId),
      getReviewVideoCredits(access.ownerId),
      getBrandKit(spaceId),
    ]);
    return NextResponse.json({
      videos,
      reviews: options.reviews,
      stats: options.stats,
      templates: TEMPLATES.map(({ id, label, description, reviews, requiresAggregate, maxChars }) => ({
        id,
        label,
        description,
        reviews,
        requiresAggregate,
        maxChars,
      })),
      credits: {
        limit: Number.isFinite(credits.limit) ? credits.limit : null,
        used: credits.used,
        remaining: Number.isFinite(credits.remaining) ? credits.remaining : null,
      },
      defaultBrand: kit?.primaryColor ?? DEFAULT_BRAND_HEX,
      /** The brand kit's video defaults, so the dialog can show what "use my brand style" means. */
      brandStyle: kit?.videoStyle ?? null,
      brandSecondary: kit?.videoSecondaryColor ?? null,
      brandFont: kit?.videoFont ?? null,
    });
  } catch (error) {
    return aiVideoErrorResponse(error, "Failed to load review videos");
  }
}

/** Creates a video (takes one credit) and queues the render. */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: spaceId } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  const parsed = createReviewVideoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Validation failed", { details: parsed.error.flatten().fieldErrors });
  }

  try {
    const video = await createReviewVideo({ spaceId, userId: access.userId, ...parsed.data });
    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    return aiVideoErrorResponse(error, "Failed to create the review video");
  }
}
