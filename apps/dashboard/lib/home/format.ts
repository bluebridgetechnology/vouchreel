/**
 * Words and shapes for the home page. Pure, so the sentences the owner reads are tested exactly.
 */

/** "up 18%", "down 5%", "no change", "new" (nothing before), or null when there is nothing either side. */
export function describeChange(current: number, previous: number): { text: string; direction: "up" | "down" | "flat" } | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return { text: "new this period", direction: "up" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: "no change", direction: "flat" };
  return pct > 0 ? { text: `up ${pct}%`, direction: "up" } : { text: `down ${Math.abs(pct)}%`, direction: "down" };
}

/** Plays as a share of impressions, as a whole percent; null when nothing was shown. */
export function playRate(plays: number, impressions: number): number | null {
  if (impressions <= 0) return null;
  return Math.round((plays / impressions) * 100);
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en")} ${n === 1 ? one : many}`;

/** The one sentence under the spotlight video, written from the numbers and nothing else. */
export function spotlightSentence(input: { name: string | null; plays: number; convertingViewers: number; days: number }): string {
  const who = input.name ? `${possessive(input.name)} video` : "This video";
  const when = input.days === 7 ? "this week" : `in the last ${input.days} days`;
  const played = `${who} was played ${count(input.plays, "time", "times")} ${when}`;
  if (input.convertingViewers <= 0) return `${played}, more than any other.`;
  return `${played}, and ${count(input.convertingViewers, "viewer", "viewers")} went on to convert.`;
}

function possessive(name: string): string {
  const first = name.trim().split(/\s+/)[0] || name;
  return /s$/i.test(first) ? `${first}'` : `${first}'s`;
}

/**
 * An SVG path for a sparkline through `values`, in a `width` x `height` box with a little headroom.
 * A flat or empty series is drawn as a line along the bottom, so an idle space reads as idle.
 */
export function sparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return `M0 ${height} L${width} ${height}`;
  const max = Math.max(...values);
  const pad = 2;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const y = (v: number) => (max === 0 ? height - pad : pad + (height - 2 * pad) * (1 - v / max));
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${round(i * step)} ${round(y(v))}`).join(" ");
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Daily buckets from `start` for `days` days, filled from sparse rows keyed by ISO day. */
export function fillDays(rows: { day: string; value: number }[], start: Date, days: number): number[] {
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), r.value]));
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    out.push(byDay.get(d.toISOString().slice(0, 10)) ?? 0);
  }
  return out;
}
