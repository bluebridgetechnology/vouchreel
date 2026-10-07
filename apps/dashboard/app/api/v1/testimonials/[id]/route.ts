import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { withApiKeyAuth, apiV1Options } from "@/lib/api/v1-handler";
import { db } from "@/lib/db";
import { deleteTestimonialPermanently } from "@/lib/spaces/delete";
import { testimonials } from "@/lib/db/schema";
import { updateTestimonialV1Schema } from "@/lib/validations/v1-api";
import { apiError, notFound, validationError } from "@/lib/api/errors";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import { log } from "@/lib/log";

export const OPTIONS = apiV1Options();

interface RouteParams {
  id: string;
}

/**
 * GET /api/v1/testimonials/[id]
 * Fetch a single testimonial by ID.
 */
export const GET = withApiKeyAuth<RouteParams>(
  async (request, { apiKey, params }) => {
    if (!params?.id) {
      return apiError(400, "BAD_REQUEST", "Testimonial ID is required");
    }

    try {
      const [item] = await db
        .select()
        .from(testimonials)
        .where(
          and(
            eq(testimonials.id, params.id),
            eq(testimonials.spaceId, apiKey.spaceId)
          )
        );

      if (!item) {
        return notFound("Testimonial not found");
      }

      return NextResponse.json({ testimonial: item });
    } catch (error) {
      log.error("v1 GET /testimonials/[id] error:", error);
      return apiError(500, "INTERNAL_ERROR", "Failed to fetch testimonial");
    }
  }
);

/**
 * PUT /api/v1/testimonials/[id]
 * Update an existing testimonial.
 */
export const PUT = withApiKeyAuth<RouteParams>(
  async (request, { apiKey, params }) => {
    if (!params?.id) {
      return apiError(400, "BAD_REQUEST", "Testimonial ID is required");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "BAD_REQUEST", "Invalid JSON payload");
    }

    const parsed = updateTestimonialV1Schema.safeParse(body);
    if (!parsed.success) {
      return validationError(
        "Validation failed",
        parsed.error.flatten().fieldErrors
      );
    }

    try {
      const [existing] = await db
        .select()
        .from(testimonials)
        .where(
          and(
            eq(testimonials.id, params.id),
            eq(testimonials.spaceId, apiKey.spaceId)
          )
        );

      if (!existing) {
        return notFound("Testimonial not found");
      }

      const [updated] = await db
        .update(testimonials)
        .set(parsed.data)
        .where(
          and(
            eq(testimonials.id, params.id),
            eq(testimonials.spaceId, apiKey.spaceId)
          )
        )
        .returning();

      // Fire webhook
      dispatchWebhookEvent({
        event: "testimonial.updated",
        spaceId: apiKey.spaceId,
        payload: { testimonial: updated },
      }).catch(() => {});

      return NextResponse.json({ testimonial: updated });
    } catch (error) {
      log.error("v1 PUT /testimonials/[id] error:", error);
      return apiError(500, "INTERNAL_ERROR", "Failed to update testimonial");
    }
  }
);

/**
 * DELETE /api/v1/testimonials/[id]
 * Delete a testimonial.
 */
export const DELETE = withApiKeyAuth<RouteParams>(
  async (request, { apiKey, params }) => {
    if (!params?.id) {
      return apiError(400, "BAD_REQUEST", "Testimonial ID is required");
    }

    try {
      const deleted = await deleteTestimonialPermanently(apiKey.spaceId, params.id);

      if (!deleted) {
        return notFound("Testimonial not found");
      }

      // Fire webhook
      dispatchWebhookEvent({
        event: "testimonial.deleted",
        spaceId: apiKey.spaceId,
        payload: { testimonialId: deleted.id },
      }).catch(() => {});

      return NextResponse.json({ success: true, id: deleted.id });
    } catch (error) {
      log.error("v1 DELETE /testimonials/[id] error:", error);
      return apiError(500, "INTERNAL_ERROR", "Failed to delete testimonial");
    }
  }
);
