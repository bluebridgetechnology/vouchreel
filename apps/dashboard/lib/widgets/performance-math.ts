/**
 * The pure parts of a widget's performance numbers (days, rates, changes). Kept apart from ./performance, which
 * reads the database, so the editor's panel can use them in the browser.
 */
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
