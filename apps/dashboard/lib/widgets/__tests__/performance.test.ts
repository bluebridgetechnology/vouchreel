import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { change, dayKey, fillSeries, playRate } from "../performance";

describe("performance helpers", () => {
  it("names the UTC day of a moment", () => {
    expect(dayKey(new Date("2026-10-09T23:59:59Z"))).toBe("2026-10-09");
    expect(dayKey(new Date("2026-10-10T00:00:00Z"))).toBe("2026-10-10");
  });

  it("fills a series of whole days ending today, keeping the days that had events", () => {
    const series = fillSeries([{ date: "2026-10-08", views: 5, plays: 2 }, { date: "2026-01-01", views: 9, plays: 9 }], 3, new Date("2026-10-09T03:00:00Z"));
    expect(series).toEqual([
      { date: "2026-10-07", views: 0, plays: 0 },
      { date: "2026-10-08", views: 5, plays: 2 },
      { date: "2026-10-09", views: 0, plays: 0 },
    ]);
  });

  it("crosses a month and a year end", () => {
    expect(fillSeries([], 3, new Date("2027-01-01T00:00:00Z")).map((d) => d.date)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });

  it("play rate is a whole percent of views, never above 100, and empty when nobody saw it", () => {
    expect(playRate(0, 0)).toBeNull();
    expect(playRate(212, 38)).toBe(18);
    expect(playRate(10, 25)).toBe(100);
    expect(playRate(3, 0)).toBe(0);
  });

  it("change is a whole percent against before, and nothing when there was no before", () => {
    expect(change(150, 100)).toBe(50);
    expect(change(50, 100)).toBe(-50);
    expect(change(100, 100)).toBe(0);
    expect(change(10, 0)).toBeNull();
  });
});
