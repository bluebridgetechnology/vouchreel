import { NextResponse } from "next/server";
import { eq, and, asc, max, count } from "drizzle-orm";
import { apiError, forbidden, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { testimonials } from "@/lib/db/schema";
import { createTestimonialSchema } from "@/lib/validations/testimonials";
import { getOEmbedMetadata, detectPlatform, validateUrl } from "@/lib/oembed";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import { verifySpaceAccess } from "@/lib/auth/permissions";
import { canAddTestimonial } from "@/lib/payments/subscription";
import { enforceTestimonialLimit } from "@/lib/payments/enforce";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/spaces/[id]/testimonials
 * List testimonials for a space, ordered by sortOrder ascending.
 * Allows owner, editor, or viewer.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id } = await params;
  const authCheck = await verifySpaceAccess(session.user.id, id, "viewer");
  if (!authCheck.success) {
    return authCheck.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  try {
    const conditions = [eq(testimonials.spaceId, id)];
    if (!includeInactive) {
      conditions.push(eq(testimonials.isActive, true));
    }

    const items = await db
      .select()
      .from(testimonials)
      .where(and(...conditions))
      .orderBy(asc(testimonials.sortOrder), asc(testimonials.createdAt));

    return NextResponse.json({ testimonials: items });
  } catch (error) {
    console.error("Failed to fetch testimonials:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch testimonials");
  }
}

/**
 * POST /api/spaces/[id]/testimonials
 * Create a new testimonial in the space with auto-fetched oEmbed metadata.
 * Allows owner or editor. Enforces testimonial plan limits.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id } = await params;
  const authCheck = await verifySpaceAccess(session.user.id, id, "editor");
  if (!authCheck.success) {
    return authCheck.errorResponse;
  }

  try {
    // Enforce the space owner's plan limit (shared with the API and approval paths)
    const blocked = await enforceTestimonialLimit(id);
    if (blocked) return blocked;

    const body = await request.json();
    const validated = createTestimonialSchema.safeParse(body);

    if (!validated.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: validated.error.flatten().fieldErrors,
      });
    }

    const data = validated.data;

    // Detect platform or use provided
    let platform = data.platform;
    if (!platform) {
      try {
        const parsed = validateUrl(data.videoUrl);
        platform = detectPlatform(parsed);
      } catch (err) {
        return apiError(
          400,
          "BAD_REQUEST",
          err instanceof Error ? err.message : "Invalid video URL"
        );
      }
    }

    // Auto-fetch oEmbed metadata if title/thumbnail/duration are missing
    let title = data.title;
    let thumbnailUrl = data.thumbnailUrl;
    let durationSeconds = data.durationSeconds;

    if (!title || !thumbnailUrl || durationSeconds === undefined) {
      try {
        const meta = await getOEmbedMetadata(data.videoUrl);
        if (!title) title = meta.title;
        if (!thumbnailUrl) thumbnailUrl = meta.thumbnailUrl || undefined;
        if (durationSeconds === undefined) durationSeconds = meta.durationSeconds;
        if (!platform) platform = meta.platform;
      } catch (err) {
        console.warn("Could not auto-fetch oEmbed metadata for testimonial:", err);
        if (!title) title = "Video Testimonial";
      }
    }

    // Calculate next sortOrder (max + 1)
    const [maxOrderResult] = await db
      .select({ maxOrder: max(testimonials.sortOrder) })
      .from(testimonials)
      .where(eq(testimonials.spaceId, id));

    const nextSortOrder =
      maxOrderResult?.maxOrder !== null && maxOrderResult?.maxOrder !== undefined
        ? maxOrderResult.maxOrder + 1
        : 0;

    const [newTestimonial] = await db
      .insert(testimonials)
      .values({
        spaceId: id,
        videoUrl: data.videoUrl,
        platform,
        title: title || "Video Testimonial",
        thumbnailUrl: thumbnailUrl || null,
        durationSeconds: durationSeconds ?? null,
        quote: data.quote || null,
        customerName: data.customerName || null,
        customerCompany: data.customerCompany || null,
        tags: data.tags || [],
        matchRules: data.matchRules || { mode: "all", urlPatterns: [], tags: [] },
        sortOrder: nextSortOrder,
        isActive: true,
        clipStatus: "none",
      })
      .returning();

    // Dispatch webhook event (non-blocking)
    dispatchWebhookEvent({
      event: "testimonial.created",
      spaceId: id,
      payload: { testimonial: newTestimonial },
    }).catch(() => {});

    return NextResponse.json(
      { testimonial: newTestimonial },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create testimonial:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to create testimonial");
  }
}
