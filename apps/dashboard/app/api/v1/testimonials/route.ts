import { NextResponse } from "next/server";
import { eq, and, asc, max } from "drizzle-orm";
import { withApiKeyAuth, apiV1Options } from "@/lib/api/v1-handler";
import { db } from "@/lib/db";
import { testimonials } from "@/lib/db/schema";
import {
  createTestimonialV1Schema,
  paginationV1Schema,
} from "@/lib/validations/v1-api";
import { apiError, validationError } from "@/lib/api/errors";
import { getOEmbedMetadata, detectPlatform, validateUrl } from "@/lib/oembed";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import { enforceTestimonialLimit } from "@/lib/payments/enforce";

export const OPTIONS = apiV1Options();

/**
 * GET /api/v1/testimonials
 * Lists testimonials for the space bound to the API key.
 * Query params: page, limit, includeInactive (true/false)
 */
export const GET = withApiKeyAuth(async (request, { apiKey }) => {
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const pagination = paginationV1Schema.safeParse({
    page: url.searchParams.get("page") ?? 1,
    limit: url.searchParams.get("limit") ?? 20,
  });

  const { page, limit } = pagination.success
    ? pagination.data
    : { page: 1, limit: 20 };
  const offset = (page - 1) * limit;

  try {
    const conditions = [eq(testimonials.spaceId, apiKey.spaceId)];
    if (!includeInactive) {
      conditions.push(eq(testimonials.isActive, true));
    }

    const items = await db
      .select()
      .from(testimonials)
      .where(and(...conditions))
      .orderBy(asc(testimonials.sortOrder), asc(testimonials.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      testimonials: items,
      pagination: {
        page,
        limit,
        count: items.length,
      },
    });
  } catch (error) {
    console.error("v1 GET /testimonials error:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch testimonials");
  }
});

/**
 * POST /api/v1/testimonials
 * Creates a new testimonial in the space bound to the API key.
 */
export const POST = withApiKeyAuth(async (request, { apiKey }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "BAD_REQUEST", "Invalid JSON payload");
  }

  const parsed = createTestimonialV1Schema.safeParse(body);
  if (!parsed.success) {
    return validationError(
      "Validation failed",
      parsed.error.flatten().fieldErrors
    );
  }

  const data = parsed.data;

  // Platform detection & normalization
  let platform = data.platform;
  if (!platform && data.videoUrl) {
    try {
      const parsedUrl = validateUrl(data.videoUrl);
      platform = detectPlatform(parsedUrl);
    } catch (err) {
      return apiError(
        400,
        "BAD_REQUEST",
        err instanceof Error ? err.message : "Invalid video URL"
      );
    }
  } else if (!platform) {
    platform = "text";
  }

  // Auto-fetch oEmbed metadata if URL is provided and metadata missing
  let title = data.title;
  let thumbnailUrl = data.thumbnailUrl;
  let durationSeconds = data.durationSeconds;

  if (data.videoUrl && (!title || !thumbnailUrl || durationSeconds === undefined)) {
    try {
      const meta = await getOEmbedMetadata(data.videoUrl);
      if (!title) title = meta.title;
      if (!thumbnailUrl) thumbnailUrl = meta.thumbnailUrl || undefined;
      if (durationSeconds === undefined) durationSeconds = meta.durationSeconds;
      if (!platform) platform = meta.platform;
    } catch {
      if (!title) title = "Video Testimonial";
    }
  }

  // Enforce the space owner's plan limit (API keys count against the owner)
  const blocked = await enforceTestimonialLimit(apiKey.spaceId);
  if (blocked) return blocked;

  try {
    // Next sort order
    const [maxOrderResult] = await db
      .select({ maxOrder: max(testimonials.sortOrder) })
      .from(testimonials)
      .where(eq(testimonials.spaceId, apiKey.spaceId));

    const nextSortOrder =
      maxOrderResult?.maxOrder !== null && maxOrderResult?.maxOrder !== undefined
        ? maxOrderResult.maxOrder + 1
        : 0;

    const [newTestimonial] = await db
      .insert(testimonials)
      .values({
        spaceId: apiKey.spaceId,
        videoUrl: data.videoUrl || null,
        platform,
        title: title || "Customer Testimonial",
        thumbnailUrl: thumbnailUrl || null,
        durationSeconds: durationSeconds ?? null,
        quote: data.quote || null,
        customerName: data.customerName || null,
        customerCompany: data.customerCompany || null,
        tags: data.tags || [],
        matchRules: data.matchRules || { mode: "all", urlPatterns: [], tags: [] },
        sortOrder: nextSortOrder,
        isActive: data.isActive ?? true,
        clipStatus: "none",
      })
      .returning();

    // Fire webhook event (async/non-blocking)
    dispatchWebhookEvent({
      event: "testimonial.created",
      spaceId: apiKey.spaceId,
      payload: { testimonial: newTestimonial },
    }).catch(() => {});

    return NextResponse.json({ testimonial: newTestimonial }, { status: 201 });
  } catch (error) {
    console.error("v1 POST /testimonials error:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to create testimonial");
  }
});
