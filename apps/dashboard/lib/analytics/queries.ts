import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, testimonials } from "@/lib/db/schema";

export type EventType = "impression" | "play" | "click" | "convert";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AnalyticsFilter {
  testimonialId?: string;
  pageUrl?: string;
  deviceType?: "mobile" | "desktop";
  trafficSource?: string;
  experimentId?: string;
  variantIndex?: number;
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

export interface ComparisonDeltas {
  impressions: number;
  plays: number;
  clicks: number;
  conversions: number;
  playRate: number | null;
  conversionRate: number | null;
  funnel: Record<EventType, number>;
}

export interface ComparativeAnalytics {
  current: {
    dateRange: DateRange;
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  previous: {
    dateRange: DateRange;
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  deltas: ComparisonDeltas;
}

export interface SegmentComparison {
  segment1: {
    name?: string;
    filter: AnalyticsFilter;
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  segment2: {
    name?: string;
    filter: AnalyticsFilter;
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  deltas: ComparisonDeltas;
}

function countFilter(eventType: EventType) {
  return sql<number>`count(*) filter (where ${events.eventType} = ${eventType})::int`;
}

/**
 * Builds SQL where conditions for events based on provided analytics filter.
 */
export function buildAnalyticsFilterConditions(filter?: AnalyticsFilter) {
  if (!filter) return [];
  const conditions = [];

  if (filter.testimonialId) {
    conditions.push(eq(events.testimonialId, filter.testimonialId));
  }
  if (filter.pageUrl) {
    conditions.push(eq(events.pageUrl, filter.pageUrl));
  }
  if (filter.deviceType) {
    conditions.push(sql`${events.metadata}->>'deviceType' = ${filter.deviceType}`);
  }
  if (filter.trafficSource) {
    conditions.push(sql`${events.metadata}->>'referrer' = ${filter.trafficSource}`);
  }
  if (filter.experimentId) {
    conditions.push(sql`${events.metadata}->>'experimentId' = ${filter.experimentId}`);
  }
  if (filter.variantIndex !== undefined && filter.variantIndex !== null) {
    conditions.push(sql`${events.metadata}->>'variantIndex' = ${filter.variantIndex.toString()}`);
  }

  return conditions;
}

/**
 * Computes percentage delta from previous to current value.
 */
export function computePercentageDelta(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Total counts per event type for a space within a date range, with optional segmentation filters.
 */
export async function getOverviewStats(
  spaceId: string,
  dateRange: DateRange,
  filter?: AnalyticsFilter
): Promise<OverviewStats> {
  const filterConditions = buildAnalyticsFilterConditions(filter);

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
        lt(events.timestamp, dateRange.end),
        ...filterConditions
      )
    );

  return (
    row ?? { impressions: 0, plays: 0, clicks: 0, conversions: 0 }
  );
}

/**
 * Per-testimonial breakdown for a space within a date range with optional filters.
 * Includes testimonials with zero events (via left join).
 */
export async function getPerTestimonialStats(
  spaceId: string,
  dateRange: DateRange,
  filter?: AnalyticsFilter
): Promise<PerTestimonialStats[]> {
  const filterConditions = buildAnalyticsFilterConditions(filter);

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
        lt(events.timestamp, dateRange.end),
        ...filterConditions
      )
    )
    .where(
      and(
        eq(testimonials.spaceId, spaceId),
        filter?.testimonialId ? eq(testimonials.id, filter.testimonialId) : undefined
      )
    )
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
 * Time-series aggregation grouped by day or week with optional segmentation filters.
 */
export async function getTimeSeries(
  spaceId: string,
  dateRange: DateRange,
  interval: TimeSeriesInterval = "day",
  filter?: AnalyticsFilter
): Promise<TimeSeriesPoint[]> {
  const bucket =
    interval === "week"
      ? sql`date_trunc('week', ${events.timestamp})`
      : sql`date_trunc('day', ${events.timestamp})`;

  const filterConditions = buildAnalyticsFilterConditions(filter);

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
        lt(events.timestamp, dateRange.end),
        ...filterConditions
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
 * Impression → play → click → convert funnel with drop-off percentages and optional segmentation filters.
 */
export async function getConversionFunnel(
  spaceId: string,
  dateRange: DateRange,
  filter?: AnalyticsFilter
): Promise<FunnelStep[]> {
  const stats = await getOverviewStats(spaceId, dateRange, filter);

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

/**
 * Computes comparative analytics between two date ranges (e.g. current vs previous period).
 */
export async function getComparativeAnalytics(
  spaceId: string,
  range1: DateRange,
  range2: DateRange,
  filter?: AnalyticsFilter
): Promise<ComparativeAnalytics> {
  const [stats1, stats2, funnel1, funnel2] = await Promise.all([
    getOverviewStats(spaceId, range1, filter),
    getOverviewStats(spaceId, range2, filter),
    getConversionFunnel(spaceId, range1, filter),
    getConversionFunnel(spaceId, range2, filter),
  ]);

  const playRate1 =
    stats1.impressions > 0 ? Math.round((stats1.plays / stats1.impressions) * 100) : null;
  const playRate2 =
    stats2.impressions > 0 ? Math.round((stats2.plays / stats2.impressions) * 100) : null;
  const convRate1 =
    stats1.impressions > 0
      ? Math.round((stats1.conversions / stats1.impressions) * 100)
      : null;
  const convRate2 =
    stats2.impressions > 0
      ? Math.round((stats2.conversions / stats2.impressions) * 100)
      : null;

  const funnelDeltas: Record<EventType, number> = {
    impression: computePercentageDelta(stats1.impressions, stats2.impressions),
    play: computePercentageDelta(stats1.plays, stats2.plays),
    click: computePercentageDelta(stats1.clicks, stats2.clicks),
    convert: computePercentageDelta(stats1.conversions, stats2.conversions),
  };

  return {
    current: {
      dateRange: range1,
      stats: stats1,
      funnel: funnel1,
      playRate: playRate1,
      conversionRate: convRate1,
    },
    previous: {
      dateRange: range2,
      stats: stats2,
      funnel: funnel2,
      playRate: playRate2,
      conversionRate: convRate2,
    },
    deltas: {
      impressions: computePercentageDelta(stats1.impressions, stats2.impressions),
      plays: computePercentageDelta(stats1.plays, stats2.plays),
      clicks: computePercentageDelta(stats1.clicks, stats2.clicks),
      conversions: computePercentageDelta(stats1.conversions, stats2.conversions),
      playRate: playRate1 !== null && playRate2 !== null ? playRate1 - playRate2 : null,
      conversionRate: convRate1 !== null && convRate2 !== null ? convRate1 - convRate2 : null,
      funnel: funnelDeltas,
    },
  };
}

/**
 * Computes comparative analytics between two segments for a given date range (e.g., Mobile vs Desktop).
 */
export async function getSegmentComparison(
  spaceId: string,
  range: DateRange,
  segment1Filter: AnalyticsFilter,
  segment2Filter: AnalyticsFilter
): Promise<SegmentComparison> {
  const [stats1, stats2, funnel1, funnel2] = await Promise.all([
    getOverviewStats(spaceId, range, segment1Filter),
    getOverviewStats(spaceId, range, segment2Filter),
    getConversionFunnel(spaceId, range, segment1Filter),
    getConversionFunnel(spaceId, range, segment2Filter),
  ]);

  const playRate1 =
    stats1.impressions > 0 ? Math.round((stats1.plays / stats1.impressions) * 100) : null;
  const playRate2 =
    stats2.impressions > 0 ? Math.round((stats2.plays / stats2.impressions) * 100) : null;
  const convRate1 =
    stats1.impressions > 0
      ? Math.round((stats1.conversions / stats1.impressions) * 100)
      : null;
  const convRate2 =
    stats2.impressions > 0
      ? Math.round((stats2.conversions / stats2.impressions) * 100)
      : null;

  const funnelDeltas: Record<EventType, number> = {
    impression: computePercentageDelta(stats1.impressions, stats2.impressions),
    play: computePercentageDelta(stats1.plays, stats2.plays),
    click: computePercentageDelta(stats1.clicks, stats2.clicks),
    convert: computePercentageDelta(stats1.conversions, stats2.conversions),
  };

  return {
    segment1: {
      filter: segment1Filter,
      stats: stats1,
      funnel: funnel1,
      playRate: playRate1,
      conversionRate: convRate1,
    },
    segment2: {
      filter: segment2Filter,
      stats: stats2,
      funnel: funnel2,
      playRate: playRate2,
      conversionRate: convRate2,
    },
    deltas: {
      impressions: computePercentageDelta(stats1.impressions, stats2.impressions),
      plays: computePercentageDelta(stats1.plays, stats2.plays),
      clicks: computePercentageDelta(stats1.clicks, stats2.clicks),
      conversions: computePercentageDelta(stats1.conversions, stats2.conversions),
      playRate: playRate1 !== null && playRate2 !== null ? playRate1 - playRate2 : null,
      conversionRate: convRate1 !== null && convRate2 !== null ? convRate1 - convRate2 : null,
      funnel: funnelDeltas,
    },
  };
}

/**
 * Returns distinct filter options (devices, traffic sources, page URLs) observed in the given date range.
 */
export async function getFilterOptions(
  spaceId: string,
  dateRange: DateRange
): Promise<{
  devices: string[];
  trafficSources: string[];
  pageUrls: string[];
}> {
  const rows = await db
    .select({
      pageUrl: events.pageUrl,
      deviceType: sql<string | null>`${events.metadata}->>'deviceType'`,
      referrer: sql<string | null>`${events.metadata}->>'referrer'`,
    })
    .from(events)
    .where(
      and(
        eq(events.spaceId, spaceId),
        gte(events.timestamp, dateRange.start),
        lt(events.timestamp, dateRange.end)
      )
    )
    .groupBy(
      events.pageUrl,
      sql`${events.metadata}->>'deviceType'`,
      sql`${events.metadata}->>'referrer'`
    )
    .limit(100);

  const devices = new Set<string>();
  const trafficSources = new Set<string>();
  const pageUrls = new Set<string>();

  for (const r of rows) {
    if (r.deviceType) devices.add(r.deviceType);
    if (r.referrer) trafficSources.add(r.referrer);
    if (r.pageUrl) pageUrls.add(r.pageUrl);
  }

  return {
    devices: Array.from(devices),
    trafficSources: Array.from(trafficSources),
    pageUrls: Array.from(pageUrls),
  };
}

/**
 * Fetches events joined with testimonial metadata for CSV export.
 */
export async function getEventsForExport(
  spaceId: string,
  dateRange: DateRange,
  filter?: AnalyticsFilter
) {
  const filterConditions = buildAnalyticsFilterConditions(filter);

  const rows = await db
    .select({
      timestamp: events.timestamp,
      eventType: events.eventType,
      pageUrl: events.pageUrl,
      sessionId: events.sessionId,
      metadata: events.metadata,
      testimonialTitle: testimonials.title,
      customerName: testimonials.customerName,
    })
    .from(events)
    .leftJoin(testimonials, eq(events.testimonialId, testimonials.id))
    .where(
      and(
        eq(events.spaceId, spaceId),
        gte(events.timestamp, dateRange.start),
        lt(events.timestamp, dateRange.end),
        ...filterConditions
      )
    )
    .orderBy(asc(events.timestamp));

  return rows;
}

/**
 * Generates RFC 4180-compliant CSV string from raw events.
 */
export function generateEventsCsv(
  eventsList: Array<{
    timestamp: Date | string;
    eventType: string;
    pageUrl: string | null;
    sessionId: string | null;
    metadata: Record<string, unknown> | null;
    testimonialTitle: string | null;
    customerName: string | null;
  }>
): string {
  const headers = [
    "Timestamp",
    "EventType",
    "TestimonialTitle",
    "CustomerName",
    "PageURL",
    "DeviceType",
    "TrafficSource",
    "SessionID",
    "ExperimentID",
    "VariantIndex",
  ];

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = eventsList.map((e) => {
    const meta = (e.metadata ?? {}) as Record<string, unknown>;
    const ts = e.timestamp instanceof Date ? e.timestamp.toISOString() : String(e.timestamp);
    const deviceType = meta.deviceType ? String(meta.deviceType) : "";
    const trafficSource = meta.referrer ? String(meta.referrer) : "";
    const experimentId = meta.experimentId ? String(meta.experimentId) : "";
    const variantIndex =
      meta.variantIndex !== undefined && meta.variantIndex !== null
        ? String(meta.variantIndex)
        : "";

    return [
      escape(ts),
      escape(e.eventType),
      escape(e.testimonialTitle ?? ""),
      escape(e.customerName ?? ""),
      escape(e.pageUrl ?? ""),
      escape(deviceType),
      escape(trafficSource),
      escape(e.sessionId ?? ""),
      escape(experimentId),
      escape(variantIndex),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
