import { timeAgo } from "@/lib/time-ago";
import type { SeenOn } from "./status";

/** The sentence above the list of sites a widget has been seen on. */
export function seenHeadline(seen: SeenOn[], scope: "space" | "widget", now: number = Date.now()): string {
  const what = scope === "widget" ? "This widget" : "Your widgets";
  if (seen.length === 0) return `${what} ${scope === "widget" ? "has" : "have"} not been seen on any site in the last 30 days. It can take a minute after you add the script.`;
  return `${what} ${scope === "widget" ? "was" : "were"} last seen on ${seen[0].host}, ${timeAgo(seen[0].lastSeen, now)}.`;
}

/** One row of the list: where, when, and how often. */
export function seenRow(entry: SeenOn, now: number = Date.now()): string {
  return `${entry.host} · ${timeAgo(entry.lastSeen, now)} · ${entry.views.toLocaleString("en")} ${entry.views === 1 ? "view" : "views"} in 30 days`;
}

/** An address to offer for checking: the site's front page. */
export function suggestedUrl(seen: SeenOn[]): string {
  return seen.length > 0 ? `https://${seen[0].host}/` : "";
}
