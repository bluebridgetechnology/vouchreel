import { NextResponse } from "next/server";
import { withApiKeyAuth, apiV1Options } from "@/lib/api/v1-handler";
import { getPerTestimonialStats } from "@/lib/analytics/queries";
import { analyticsQuerySchema, resolveDateRange } from "@/lib/validations/analytics";
import { apiError, validationError } from "@/lib/api/errors";
import { log } from "@/lib/log";

export const OPTIONS = apiV1Options();

/**
 * GET /api/v1/analytics/testimonials
 * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 */
export const GET = withApiKeyAuth(
  async (request, { apiKey }) => {
    const url = new URL(request.url);
    const parsed = analyticsQuerySchema.safeParse({
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
    });

    if (!parsed.success) {
      return validationError("Validation failed", parsed.error.flatten().fieldErrors);
    }

    try {
      const dateRange = resolveDateRange(parsed.data);
      const items = await getPerTestimonialStats(apiKey.spaceId, dateRange);

      return NextResponse.json({
        testimonials: items,
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
      });
    } catch (error) {
      log.error("v1 GET /analytics/testimonials error:", error);
      return apiError(500, "INTERNAL_ERROR", "Failed to fetch per-testimonial analytics");
    }
  },
  { rateLimitMax: 30 }
);
