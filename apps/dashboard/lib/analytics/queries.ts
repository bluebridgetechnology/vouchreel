import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, testimonials } from "@/lib/db/schema";

export type EventType = "impression" | "play" | "click" | "convert";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface OverviewStats {
  impressions: number;
  plays: number;
  clicks: number;
  conversions: number;
}

export interface PerTestimonialStats {
  testimonialId: string | null;
  title: string | null;
  customerName: string | null;
  thumbnailUrl: string | null;
  isActive: boolean | null;
  impressions: number;
  plays: number;
  clicks: number;
  conversions: number;
}

export interface TimeSeriesPoint {
  date: string;
  impressions: number;
  plays: number;
}

export type TimeSeriesInterval = "day" | "week";

export interface FunnelStep {
  step: EventType;
  count: number;
  dropOffPercent: number | null;
  conversionFromPrevious: number | null;
}

function countFilter(eventType: EventType) {
  return sql<number>`count(*) filter (where ${events.eventType} = ${eventType})::int`;
}

/**
 * Total counts per event type for a space within a date range.
 */
export async function getOverviewStats(
  spaceId: string,
  dateRange: DateRange
): Promise<OverviewStats> {
  const [row] = await db
    .select({
      impressions: countFilter("impression"),
      plays: countFilter("play"),
      clicks: countFilter("click"),
      conversions: countFilter("convert"),
    })
    .from(events)
    .where(
      and(
        eq(events.spaceId, spaceId),
        gte(events.timestamp, dateRange.start),
        lt(events.timestamp, dateRange.end)
      )
    );

  return (
    row ?? { impressions: 0, plays: 0, clicks: 0, conversions: 0 }
  );
}

/**
 * Per-testimonial breakdown for a space within a date range.
 * Includes testimonials with zero events (via left join).
 */
export async function getPerTestimonialStats(
  spaceId: string,
  dateRange: DateRange
): Promise<PerTestimonialStats[]> {
  const rows = await db
    .select({
      testimonialId: testimonials.id,
      title: testimonials.title,
      customerName: testimonials.customerName,
      thumbnailUrl: testimonials.thumbnailUrl,
      isActive: testimonials.isActive,
      impressions: sql<number>`count(${events.id}) filter (where ${events.eventType} = 'impression')::int`,
      plays: sql<number>`count(${events.id}) filter (where ${events.eventType} = 'play')::int`,
      clicks: sql<number>`count(${events.id}) filter (where ${events.eventType} = 'click')::int`,
      conversions: sql<number>`count(${events.id}) filter (where ${events.eventType} = 'convert')::int`,
    })
    .from(testimonials)
    .leftJoin(
      events,
      and(
        eq(events.testimonialId, testimonials.id),
        gte(events.timestamp, dateRange.start),
        lt(events.timestamp, dateRange.end)
      )
    )
    .where(eq(testimonials.spaceId, spaceId))
    .groupBy(
      testimonials.id,
      testimonials.title,
      testimonials.customerName,
      testimonials.thumbnailUrl,
      testimonials.isActive,
      testimonials.sortOrder
    )
    .orderBy(asc(testimonials.sortOrder));

  return rows;
}

/**
 * Time-series aggregation grouped by day or week.
 */
export async function getTimeSeries(
  spaceId: string,
  dateRange: DateRange,
  interval: TimeSeriesInterval = "day"
): Promise<TimeSeriesPoint[]> {
  const bucket =
    interval === "week"
      ? sql`date_trunc('week', ${events.timestamp})`
      : sql`date_trunc('day', ${events.timestamp})`;

  const rows = await db
    .select({
      date: sql<string>`${bucket}::text`,
      impressions: countFilter("impression"),
      plays: countFilter("play"),
    })
    .from(events)
    .where(
      and(
        eq(events.spaceId, spaceId),
        gte(events.timestamp, dateRange.start),
        lt(events.timestamp, dateRange.end)
      )
    )
    .groupBy(bucket)
    .orderBy(asc(bucket));

  return rows.map((r) => ({
    date: r.date,
    impressions: r.impressions,
    plays: r.plays,
  }));
}

/**
 * Impression → play → click → convert funnel with drop-off percentages.
 */
export async function getConversionFunnel(
  spaceId: string,
  dateRange: DateRange
): Promise<FunnelStep[]> {
  const stats = await getOverviewStats(spaceId, dateRange);

  const steps: Array<[EventType, number]> = [
    ["impression", stats.impressions],
    ["play", stats.plays],
    ["click", stats.clicks],
    ["convert", stats.conversions],
  ];

  return steps.map(([step, count], i) => {
    const previous = i > 0 ? steps[i - 1][1] : null;
    return {
      step,
      count,
      dropOffPercent:
        previous && previous > 0
          ? Math.round(((previous - count) / previous) * 100)
          : null,
      conversionFromPrevious:
        previous && previous > 0
          ? Math.round((count / previous) * 100)
          : null,
    };
  });
}
