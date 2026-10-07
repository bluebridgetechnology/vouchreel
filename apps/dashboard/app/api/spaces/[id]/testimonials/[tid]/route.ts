import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { apiError, notFound, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { testimonials } from "@/lib/db/schema";
import { updateTestimonialSchema } from "@/lib/validations/testimonials";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import { verifySpaceAccess, TeamRole } from "@/lib/auth/permissions";
import { deleteTestimonialPermanently } from "@/lib/spaces/delete";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string; tid: string }>;
}

/**
 * Helper to verify user permissions and testimonial existence
 */
async function verifySpaceAndTestimonial(
  spaceId: string,
  testimonialId: string,
  userId: string,
  minRole: TeamRole = "viewer"
) {
  const authCheck = await verifySpaceAccess(userId, spaceId, minRole);
  if (!authCheck.success) {
    return { errorResponse: authCheck.errorResponse };
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
    return { errorResponse: notFound("Testimonial not found") };
  }

  return { space: authCheck.access.space, testimonial };
}

/**
 * GET /api/spaces/[id]/testimonials/[tid]
 * Allows owner, editor, or viewer.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id, tid } = await params;
  const result = await verifySpaceAndTestimonial(id, tid, session.user.id, "viewer");
  if (result.errorResponse) {
    return result.errorResponse;
  }

  return NextResponse.json({ testimonial: result.testimonial });
}

/**
 * PUT /api/spaces/[id]/testimonials/[tid]
 * Allows owner or editor.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id, tid } = await params;
  const result = await verifySpaceAndTestimonial(id, tid, session.user.id, "editor");
  if (result.errorResponse) {
    return result.errorResponse;
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
    log.error("Failed to update testimonial:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to update testimonial");
  }
}

/**
 * DELETE /api/spaces/[id]/testimonials/[tid]
 * Permanently deletes the testimonial and, through a queued cleanup job, the files it owns: its
 * video, thumbnail and clip, and its social exports' and AI videos' files. Allows owner or editor.
 * Hiding without deleting is the PATCH `isActive` toggle ("Disable").
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id, tid } = await params;
  const result = await verifySpaceAndTestimonial(id, tid, session.user.id, "editor");
  if (result.errorResponse) {
    return result.errorResponse;
  }

  try {
    const deleted = await deleteTestimonialPermanently(id, tid);
    if (!deleted) return notFound("Testimonial not found");

    // Dispatch webhook event (non-blocking)
    dispatchWebhookEvent({
      event: "testimonial.deleted",
      spaceId: id,
      payload: { testimonialId: tid },
    }).catch(() => {});

    return NextResponse.json({ success: true, id: tid });
  } catch (error) {
    log.error("Failed to delete testimonial:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to delete testimonial");
  }
}
