import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, testimonials } from "@/lib/db/schema";
import { updateTestimonialSchema } from "@/lib/validations/testimonials";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

interface RouteParams {
  params: Promise<{ id: string; tid: string }>;
}

/**
 * Helper to verify user ownership and testimonial existence
 */
async function verifySpaceAndTestimonial(
  spaceId: string,
  testimonialId: string,
  userId: string
) {
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

  const [testimonial] = await db
    .select()
    .from(testimonials)
    .where(
      and(
        eq(testimonials.id, testimonialId),
        eq(testimonials.spaceId, spaceId)
      )
    );

  if (!testimonial) {
    return {
      error: { code: "NOT_FOUND" as const, message: "Testimonial not found" },
      status: 404 as const,
    };
  }

  return { space, testimonial };
}

/**
 * GET /api/spaces/[id]/testimonials/[tid]
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id, tid } = await params;
  const result = await verifySpaceAndTestimonial(id, tid, session.user.id);
  if (result.error) {
    return apiError(
      result.status,
      result.error.code,
      result.error.message
    );
  }

  return NextResponse.json({ testimonial: result.testimonial });
}

/**
 * PUT /api/spaces/[id]/testimonials/[tid]
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id, tid } = await params;
  const result = await verifySpaceAndTestimonial(id, tid, session.user.id);
  if (result.error) {
    return apiError(
      result.status,
      result.error.code,
      result.error.message
    );
  }

  try {
    const body = await request.json();
    const validated = updateTestimonialSchema.safeParse(body);

    if (!validated.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: validated.error.flatten().fieldErrors,
      });
    }

    const data = validated.data;
    const updatePayload: Record<string, unknown> = {};

    if (data.videoUrl !== undefined) updatePayload.videoUrl = data.videoUrl;
    if (data.platform !== undefined) updatePayload.platform = data.platform;
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.thumbnailUrl !== undefined) updatePayload.thumbnailUrl = data.thumbnailUrl;
    if (data.durationSeconds !== undefined) updatePayload.durationSeconds = data.durationSeconds;
    if (data.quote !== undefined) updatePayload.quote = data.quote;
    if (data.customerName !== undefined) updatePayload.customerName = data.customerName;
    if (data.customerCompany !== undefined) updatePayload.customerCompany = data.customerCompany;
    if (data.tags !== undefined) updatePayload.tags = data.tags;
    if (data.matchRules !== undefined) updatePayload.matchRules = data.matchRules;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
    if (data.sortOrder !== undefined) updatePayload.sortOrder = data.sortOrder;

    const [updated] = await db
      .update(testimonials)
      .set(updatePayload)
      .where(
        and(
          eq(testimonials.id, tid),
          eq(testimonials.spaceId, id)
        )
      )
      .returning();

    // Dispatch webhook event (non-blocking)
    dispatchWebhookEvent({
      event: "testimonial.updated",
      spaceId: id,
      payload: { testimonial: updated },
    }).catch(() => {});

    return NextResponse.json({ testimonial: updated });
  } catch (error) {
    console.error("Failed to update testimonial:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to update testimonial");
  }
}

/**
 * DELETE /api/spaces/[id]/testimonials/[tid]
 * Soft-delete testimonial (sets isActive = false)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id, tid } = await params;
  const result = await verifySpaceAndTestimonial(id, tid, session.user.id);
  if (result.error) {
    return apiError(
      result.status,
      result.error.code,
      result.error.message
    );
  }

  try {
    // Soft delete per spec: set isActive = false
    await db
      .update(testimonials)
      .set({ isActive: false })
      .where(
        and(
          eq(testimonials.id, tid),
          eq(testimonials.spaceId, id)
        )
      );

    // Dispatch webhook event (non-blocking)
    dispatchWebhookEvent({
      event: "testimonial.deleted",
      spaceId: id,
      payload: { testimonialId: tid },
    }).catch(() => {});

    return NextResponse.json({ success: true, id: tid });
  } catch (error) {
    console.error("Failed to soft-delete testimonial:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to delete testimonial");
  }
}
