import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import {
  getConversionFunnel,
  getOverviewStats,
  getPerTestimonialStats,
  getTimeSeries,
} from "@/lib/analytics/queries";
import { analyticsQuerySchema, resolveDateRange } from "@/lib/validations/analytics";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/spaces/[id]/analytics
 * Query params: type (overview|testimonials|timeseries|funnel),
 * startDate, endDate (YYYY-MM-DD), interval (day|week). Defaults to last 30 days.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const parsed = analyticsQuerySchema.safeParse({
    type: url.searchParams.get("type") ?? undefined,
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
    interval: url.searchParams.get("interval") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const [space] = await db.select().from(spaces).where(eq(spaces.id, id));

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (space.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this space" },
        { status: 403 }
      );
    }

    const dateRange = resolveDateRange(parsed.data);

    switch (parsed.data.type) {
      case "overview": {
        const stats = await getOverviewStats(space.id, dateRange);
        return NextResponse.json({ stats, dateRange });
      }
      case "testimonials": {
        const testimonials = await getPerTestimonialStats(space.id, dateRange);
        return NextResponse.json({ testimonials, dateRange });
      }
      case "timeseries": {
        const points = await getTimeSeries(
          space.id,
          dateRange,
          parsed.data.interval
        );
        return NextResponse.json({ points, dateRange, interval: parsed.data.interval });
      }
      case "funnel": {
        const funnel = await getConversionFunnel(space.id, dateRange);
        return NextResponse.json({ funnel, dateRange });
      }
    }
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
