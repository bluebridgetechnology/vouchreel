/** Words for the widgets page. Pure, so the sentences the owner reads are tested exactly. */

export interface WidgetQuotaView {
  current: number;
  /** null when the plan has no limit. */
  limit: number | null;
  allowed: boolean;
}

const widgets = (n: number) => (n === 1 ? "widget" : "widgets");

/** "2 of 3 widgets", or "2 widgets" when the plan has no limit. */
export function quotaLabel(q: WidgetQuotaView): string {
  return q.limit === null ? `${q.current} ${widgets(q.current)}` : `${q.current} of ${q.limit} ${widgets(q.limit)}`;
}

/** Said under the header once the plan's limit is reached; null while there is room. */
export function limitHint(q: WidgetQuotaView): string | null {
  if (q.allowed || q.limit === null) return null;
  return `Your plan allows ${q.limit} ${widgets(q.limit)} per space. Upgrade to add more.`;
}

export interface WidgetStatusInput {
  isLive: boolean;
  publishedAt: string | null;
  hasDraft: boolean;
}

export interface WidgetStatus {
  label: string;
  tone: "success" | "neutral" | "info";
  /** Only for a live widget: edits saved as a draft that visitors do not see yet. */
  pendingChanges: boolean;
}

/** What to say about a widget: on for visitors, off, or never switched on. */
export function widgetStatus(w: WidgetStatusInput): WidgetStatus {
  if (w.isLive) return { label: "Live", tone: "success", pendingChanges: w.hasDraft };
  return w.publishedAt ? { label: "Off", tone: "neutral", pendingChanges: false } : { label: "Not live yet", tone: "info", pendingChanges: false };
}

export interface WidgetNumbers {
  views: number;
  plays: number;
}

const n = (value: number) => value.toLocaleString("en");

/**
 * The line of numbers on a widget's card, for the last 30 days. A widget visitors do not see has nothing to
 * report; one they do see but that was never shown says so, rather than printing zeros.
 */
export function numbersLine(w: { isLive: boolean }, stats: WidgetNumbers | undefined): string | null {
  if (!stats || stats.views + stats.plays === 0) return w.isLive ? "Not seen by anyone in the last 30 days" : null;
  const parts = [`${n(stats.views)} ${stats.views === 1 ? "view" : "views"}`, `${n(stats.plays)} ${stats.plays === 1 ? "play" : "plays"}`];
  if (stats.views > 0 && stats.plays <= stats.views) parts.push(`${Math.round((stats.plays / stats.views) * 100)}% played`);
  return parts.join(" · ");
}
