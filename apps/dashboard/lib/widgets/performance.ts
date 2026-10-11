import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { fillSeries, type WidgetPerformance } from "./performance-math";

const DAY = 86_400_000;

export * from "./performance-math";

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
