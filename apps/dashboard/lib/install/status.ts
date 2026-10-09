import { and, desc, eq, gte, isNotNull, max, sql, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";

export interface SeenOn {
  /** The site's host, like "shop.acme.com": never the page's path or query, which can hold personal details. */
  host: string;
  lastSeen: string;
  /** Times a widget was shown there in the window. */
  views: number;
}

/** The host of a page address, as SQL: after "://", up to the first "/" or "?", without any "user@". */
const hostOf = sql<string>`lower(regexp_replace(split_part(split_part(split_part(${events.pageUrl}, '://', 2), '/', 1), '?', 1), '^.*@', ''))`;

/**
 * Where a space's widgets (or one widget) have really been shown lately: the sites that recorded a view, most
 * recent first. This is the proof that an install works, since it comes from visitors' browsers.
 */
export async function getSeenOn(spaceId: string, options: { widgetId?: string; days?: number; now?: Date; limit?: number } = {}): Promise<SeenOn[]> {
  const since = new Date((options.now ?? new Date()).getTime() - (options.days ?? 30) * 86_400_000);
  const rows = await db
    .select({ host: hostOf, lastSeen: max(events.timestamp), views: count() })
    .from(events)
    .where(
      and(
        eq(events.spaceId, spaceId),
        eq(events.eventType, "impression"),
        isNotNull(events.pageUrl),
        gte(events.timestamp, since),
        options.widgetId ? eq(events.widgetId, options.widgetId) : undefined,
        sql`${hostOf} <> ''`
      )
    )
    .groupBy(hostOf)
    .orderBy(desc(max(events.timestamp)))
    .limit(options.limit ?? 5);

  return rows.filter((r) => r.lastSeen).map((r) => ({ host: r.host, lastSeen: r.lastSeen!.toISOString(), views: r.views }));
}
