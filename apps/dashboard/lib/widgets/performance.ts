import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";

const DAY = 86_400_000;

export interface DayPoint {
  /** The UTC day, "2026-10-09". */
  date: string;
  views: number;
  plays: number;
}

export interface WidgetPerformance {
  days: number;
  views: number;
  plays: number;
  clicks: number;
  /** The same totals for the `days` before that, to say whether it is going up or down. */
  previous: { views: number; plays: number; clicks: number };
  /** One point per day, oldest first, zeros included. */
  series: DayPoint[];
}

/** The UTC day of a moment, "2026-10-09". */
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** One point for each of the last `days` UTC days ending with today, filling the days that had no events with zeros. */
export function fillSeries(rows: { date: string; views: number; plays: number }[], days: number, now: Date): DayPoint[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, i) => {
    const date = dayKey(new Date(today - (days - 1 - i) * DAY));
    const row = byDate.get(date);
    return { date, views: row?.views ?? 0, plays: row?.plays ?? 0 };
  });
}

/** Share of views that led to a play, as a whole percent, or null when nobody has seen it. */
export const playRate = (views: number, plays: number): number | null => (views > 0 ? Math.round((Math.min(plays, views) / views) * 100) : null);

/** Change from `previous` to `current` as a whole percent, or null when there is nothing before to compare with. */
export function change(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * How one widget did over the last `days` days (default 30) and the `days` before, from the events that name it.
 * The window is whole UTC days ending today, so the daily bars and the totals agree. Conversions belong to the
 * page, not to a widget, so they are not here.
 */
export async function getWidgetPerformance(spaceId: string, widgetId: string, days = 30, now = new Date()): Promise<WidgetPerformance> {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = new Date(today - (days - 1) * DAY);
  const previousStart = new Date(start.getTime() - days * DAY);
  const day = sql<string>`to_char(${events.timestamp} at time zone 'UTC', 'YYYY-MM-DD')`;
  const count = (type: string, when = sql`true`) => sql<number>`count(*) filter (where ${events.eventType} = ${type} and ${when})::int`;
  const mine = and(eq(events.spaceId, spaceId), eq(events.widgetId, widgetId));

  const [perDay, [previous]] = await Promise.all([
    db
      .select({ date: day, views: count("impression"), plays: count("play"), clicks: count("click") })
      .from(events)
      .where(and(mine, gte(events.timestamp, start)))
      .groupBy(day),
    db
      .select({ views: count("impression"), plays: count("play"), clicks: count("click") })
      .from(events)
      .where(and(mine, gte(events.timestamp, previousStart), lt(events.timestamp, start))),
  ]);

  const total = (key: "views" | "plays" | "clicks") => perDay.reduce((sum, r) => sum + r[key], 0);
  return {
    days,
    views: total("views"),
    plays: total("plays"),
    clicks: total("clicks"),
    previous: { views: previous?.views ?? 0, plays: previous?.plays ?? 0, clicks: previous?.clicks ?? 0 },
    series: fillSeries(perDay, days, now),
  };
}
