import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import {
  AnalyticsFilter,
  getComparativeAnalytics,
  getConversionFunnel,
  getFilterOptions,
  getOverviewStats,
  getPerTestimonialStats,
  getSegmentComparison,
  getTimeSeries,
} from "@/lib/analytics/queries";
import {
  analyticsQuerySchema,
  resolveDateRange,
  resolvePreviousDateRange,
} from "@/lib/validations/analytics";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/spaces/[id]/analytics
 * Query params:
 *   - type: overview | testimonials | timeseries | funnel | comparison | segment-comparison | filter-options
 *   - startDate, endDate (YYYY-MM-DD), interval (day|week)
 *   - Filters: testimonialId, pageUrl, deviceType, trafficSource, experimentId, variantIndex
 *   - Comparison: compareRange (boolean/string), compareSegment (device), prevStartDate, prevEndDate
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;
  const url = new URL(request.url);
  const parsed = analyticsQuerySchema.safeParse({
    type: url.searchParams.get("type") ?? undefined,
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
    interval: url.searchParams.get("interval") ?? undefined,
    testimonialId: url.searchParams.get("testimonialId") ?? undefined,
    pageUrl: url.searchParams.get("pageUrl") ?? undefined,
    deviceType: url.searchParams.get("deviceType") ?? undefined,
    trafficSource: url.searchParams.get("trafficSource") ?? undefined,
    experimentId: url.searchParams.get("experimentId") ?? undefined,
    variantIndex: url.searchParams.get("variantIndex") ?? undefined,
    compareRange: url.searchParams.get("compareRange") ?? undefined,
    compareSegment: url.searchParams.get("compareSegment") ?? undefined,
    prevStartDate: url.searchParams.get("prevStartDate") ?? undefined,
    prevEndDate: url.searchParams.get("prevEndDate") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Validation failed", {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const [space] = await db.select().from(spaces).where(eq(spaces.id, id));

    if (!space) {
      return apiError(404, "NOT_FOUND", "Space not found");
    }

    if (space.ownerId !== session.user.id) {
      return apiError(403, "FORBIDDEN", "Forbidden: You do not own this space");
    }

    const dateRange = resolveDateRange(parsed.data);
    const filter: AnalyticsFilter = {
      testimonialId: parsed.data.testimonialId,
      pageUrl: parsed.data.pageUrl,
      deviceType: parsed.data.deviceType,
      trafficSource: parsed.data.trafficSource,
      experimentId: parsed.data.experimentId,
      variantIndex: parsed.data.variantIndex,
    };

    switch (parsed.data.type) {
      case "comparison": {
        const prevRange = resolvePreviousDateRange(dateRange, parsed.data);
        const comparison = await getComparativeAnalytics(
          space.id,
          dateRange,
          prevRange,
          filter
        );
        return NextResponse.json({ comparison, dateRange, prevRange, filter });
      }
      case "segment-comparison": {
        const seg1: AnalyticsFilter = { ...filter, deviceType: "mobile" };
        const seg2: AnalyticsFilter = { ...filter, deviceType: "desktop" };
        const segmentComparison = await getSegmentComparison(
          space.id,
          dateRange,
          seg1,
          seg2
        );
        return NextResponse.json({
          segmentComparison,
          dateRange,
          compareSegment: parsed.data.compareSegment ?? "device",
        });
      }
      case "filter-options": {
        const filterOptions = await getFilterOptions(space.id, dateRange);
        return NextResponse.json({ filterOptions });
      }
      case "overview": {
        const stats = await getOverviewStats(space.id, dateRange, filter);
        let comparison = undefined;
        if (parsed.data.compareRange) {
          const prevRange = resolvePreviousDateRange(dateRange, parsed.data);
          comparison = await getComparativeAnalytics(
            space.id,
            dateRange,
            prevRange,
            filter
          );
        }
        let segmentComparison = undefined;
        if (parsed.data.compareSegment) {
          segmentComparison = await getSegmentComparison(
            space.id,
            dateRange,
            { ...filter, deviceType: "mobile" },
            { ...filter, deviceType: "desktop" }
          );
        }
        return NextResponse.json({
          stats,
          dateRange,
          filter,
          ...(comparison ? { comparison } : {}),
          ...(segmentComparison ? { segmentComparison } : {}),
        });
      }
      case "testimonials": {
        const testimonials = await getPerTestimonialStats(
          space.id,
          dateRange,
          filter
        );
        return NextResponse.json({ testimonials, dateRange, filter });
      }
      case "timeseries": {
        const points = await getTimeSeries(
          space.id,
          dateRange,
          parsed.data.interval,
          filter
        );
        return NextResponse.json({
          points,
          dateRange,
          interval: parsed.data.interval,
          filter,
        });
      }
      case "funnel": {
        const funnel = await getConversionFunnel(space.id, dateRange, filter);
        let comparison = undefined;
        if (parsed.data.compareRange) {
          const prevRange = resolvePreviousDateRange(dateRange, parsed.data);
          comparison = await getComparativeAnalytics(
            space.id,
            dateRange,
            prevRange,
            filter
          );
        }
        return NextResponse.json({
          funnel,
          dateRange,
          filter,
          ...(comparison ? { comparison } : {}),
        });
      }
    }
  } catch (error) {
    log.error("Failed to fetch analytics:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch analytics");
  }
}
