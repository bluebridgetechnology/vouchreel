import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";

export interface WidgetStats {
  /** Times the widget was shown to a visitor. */
  views: number;
  /** Times a video was played from it. */
  plays: number;
}

/**
 * What each of a space's widgets did over the last `days` days, from the events that name their widget (one
 * grouped query on the per-widget index). Widgets with no such events are absent. Events from before widgets
 * were told apart, and conversions (which belong to the page, not a widget), are not in these numbers.
 */
export async function getWidgetStats(spaceId: string, days = 30, now = new Date()): Promise<Map<string, WidgetStats>> {
  const since = new Date(now.getTime() - days * 86_400_000);
  const rows = await db
    .select({
      widgetId: events.widgetId,
      views: sql<number>`count(*) filter (where ${events.eventType} = 'impression')::int`,
      plays: sql<number>`count(*) filter (where ${events.eventType} = 'play')::int`,
    })
    .from(events)
    .where(and(eq(events.spaceId, spaceId), isNotNull(events.widgetId), gte(events.timestamp, since)))
    .groupBy(events.widgetId);

  const stats = new Map<string, WidgetStats>();
  for (const r of rows) if (r.widgetId) stats.set(r.widgetId, { views: r.views, plays: r.plays });
  return stats;
}
