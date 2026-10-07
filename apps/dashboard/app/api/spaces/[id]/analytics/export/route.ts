import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import {
  AnalyticsFilter,
  generateEventsCsv,
  getEventsForExport,
} from "@/lib/analytics/queries";
import {
  analyticsExportQuerySchema,
  resolveDateRange,
} from "@/lib/validations/analytics";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/spaces/[id]/analytics/export
 * Query params: format (csv), startDate, endDate (YYYY-MM-DD),
 * and optional segmentation filters (testimonialId, pageUrl, deviceType, trafficSource, experimentId, variantIndex).
 *
 * Returns raw events as CSV attachment.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;
  const url = new URL(request.url);
  const parsed = analyticsExportQuerySchema.safeParse({
    format: url.searchParams.get("format") ?? undefined,
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
    testimonialId: url.searchParams.get("testimonialId") ?? undefined,
    pageUrl: url.searchParams.get("pageUrl") ?? undefined,
    deviceType: url.searchParams.get("deviceType") ?? undefined,
    trafficSource: url.searchParams.get("trafficSource") ?? undefined,
    experimentId: url.searchParams.get("experimentId") ?? undefined,
    variantIndex: url.searchParams.get("variantIndex") ?? undefined,
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

    const rawEvents = await getEventsForExport(space.id, dateRange, filter);
    const csvContent = generateEventsCsv(rawEvents);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vouchreel-analytics-${space.id}.csv"`,
      },
    });
  } catch (error) {
    log.error("Failed to export analytics CSV:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to export analytics");
  }
}
