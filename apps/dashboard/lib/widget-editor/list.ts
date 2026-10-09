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
