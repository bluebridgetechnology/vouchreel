import { NextResponse } from "next/server";
import { eq, and, asc, max } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, testimonials } from "@/lib/db/schema";
import { createTestimonialSchema } from "@/lib/validations/testimonials";
import { getOEmbedMetadata, detectPlatform, validateUrl } from "@/lib/oembed";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Verifies that the authenticated user owns the space.
 */
async function verifySpaceOwner(spaceId: string, userId: string) {
  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, spaceId));

  if (!space) {
    return {
      error: { code: "NOT_FOUND" as const, message: "Space not found" },
      status: 404 as const,
    };
  }

  if (space.ownerId !== userId) {
    return {
      error: {
        code: "FORBIDDEN" as const,
        message: "Forbidden: You do not own this space",
      },
      status: 403 as const,
    };
  }

  return { space };
}

/**
 * GET /api/spaces/[id]/testimonials
 * List testimonials for a space, ordered by sortOrder ascending.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;
  const authResult = await verifySpaceOwner(id, session.user.id);
  if (authResult.error) {
    return apiError(
      authResult.status,
      authResult.error.code,
      authResult.error.message
    );
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
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;
  const authResult = await verifySpaceOwner(id, session.user.id);
  if (authResult.error) {
    return apiError(
      authResult.status,
      authResult.error.code,
      authResult.error.message
    );
  }

  try {
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
        // If title still empty, fallback to video URL
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
