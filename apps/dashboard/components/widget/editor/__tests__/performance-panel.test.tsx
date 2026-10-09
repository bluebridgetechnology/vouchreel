import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { fillSeries } from "@/lib/widgets/performance";
import { PerformanceBody, PerformancePanel, type Data } from "../performance-panel";

const now = new Date("2026-10-09T12:00:00Z");
const data = (over: Partial<Data> = {}): Data => ({
  days: 30,
  views: 1204,
  plays: 212,
  clicks: 9,
  previous: { views: 1000, plays: 300, clicks: 0 },
  series: fillSeries([{ date: "2026-10-09", views: 40, plays: 10 }, { date: "2026-10-05", views: 20, plays: 0 }], 30, now),
  publishedAt: "2026-10-05T09:00:00Z",
  isLive: true,
  ...over,
});
const body = (d: Data) => renderToStaticMarkup(<PerformanceBody data={d} now={now.getTime()} />);

describe("the editor's performance panel", () => {
  it("shows views, plays, play rate and clicks, and whether each is up or down on the 30 days before", () => {
    const html = body(data());
    expect(html).toContain("1,204");
    expect(html).toContain("212");
    expect(html).toContain("18%"); // played
    expect(html).toContain("up 20%"); // views 1000 -> 1204
    expect(html).toContain("down 29%"); // plays 300 -> 212
    expect(html).not.toMatch(/clicks[\s\S]*up|Clicks[\s\S]*?up \d/); // no earlier clicks: nothing to compare
  });

  it("draws a bar a day with a text alternative, and marks the day it was published", () => {
    const html = body(data());
    expect(html.match(/<title>/g)).toHaveLength(30);
    expect(html).toContain("1,204 views, 212 plays in total");
    expect(html).toContain("The line marks when you last published");
  });

  it("does not mention a publish that is outside the 30 days", () => {
    expect(body(data({ publishedAt: "2026-01-01T00:00:00Z" }))).not.toContain("The line marks");
  });

  it("says so, with no chart, when nobody has seen the widget", () => {
    const html = body(data({ views: 0, plays: 0, clicks: 0, series: fillSeries([], 30, now) }));
    expect(html).toContain("Nobody has seen this widget yet");
    expect(html).not.toContain("<svg");
  });

  it("the panel starts as a closed summary that says it is loading", () => {
    const html = renderToStaticMarkup(<PerformancePanel spaceId="s" widgetId="w" />);
    expect(html).toContain("How it is doing");
    expect(html).toContain("Loading");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });
});
