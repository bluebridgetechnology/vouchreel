import { NextResponse } from "next/server";
import { withApiKeyAuth, apiV1Options } from "@/lib/api/v1-handler";
import { getOverviewStats } from "@/lib/analytics/queries";
import { analyticsQuerySchema, resolveDateRange } from "@/lib/validations/analytics";
import { apiError, validationError } from "@/lib/api/errors";
import { log } from "@/lib/log";

export const OPTIONS = apiV1Options();

/**
 * GET /api/v1/analytics/overview
 * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD). Defaults to past 30 days.
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
      const stats = await getOverviewStats(apiKey.spaceId, dateRange);

      return NextResponse.json({
        stats,
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
      });
    } catch (error) {
      log.error("v1 GET /analytics/overview error:", error);
      return apiError(500, "INTERNAL_ERROR", "Failed to fetch analytics overview");
    }
  },
  { rateLimitMax: 30 } // Analytics rate limit 30 req/min
);
