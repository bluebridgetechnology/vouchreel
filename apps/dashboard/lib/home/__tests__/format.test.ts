import { describe, expect, it } from "vitest";
import { describeChange, fillDays, playRate, sparklinePath, spotlightSentence } from "../format";

describe("home page wording", () => {
  it("describes a change in words", () => {
    expect(describeChange(118, 100)).toEqual({ text: "up 18%", direction: "up" });
    expect(describeChange(95, 100)).toEqual({ text: "down 5%", direction: "down" });
    expect(describeChange(100, 100)).toEqual({ text: "no change", direction: "flat" });
    expect(describeChange(4, 0)).toEqual({ text: "new this period", direction: "up" });
    expect(describeChange(0, 0)).toBeNull();
  });

  it("play rate is a whole percent, and nothing when nothing was shown", () => {
    expect(playRate(25, 200)).toBe(13);
    expect(playRate(0, 0)).toBeNull();
  });

  it("the spotlight sentence says only what the numbers say", () => {
    expect(spotlightSentence({ name: "Sarah Chen", plays: 412, convertingViewers: 23, days: 7 })).toBe(
      "Sarah's video was played 412 times this week, and 23 viewers went on to convert."
    );
    expect(spotlightSentence({ name: "James", plays: 1, convertingViewers: 1, days: 7 })).toBe(
      "James' video was played 1 time this week, and 1 viewer went on to convert."
    );
    expect(spotlightSentence({ name: null, plays: 1200, convertingViewers: 0, days: 30 })).toBe(
      "This video was played 1,200 times in the last 30 days, more than any other."
    );
  });

  it("fills missing days with zero, in order", () => {
    const start = new Date("2026-10-01T00:00:00Z");
    expect(fillDays([{ day: "2026-10-03", value: 5 }, { day: "2026-10-01", value: 2 }], start, 4)).toEqual([2, 0, 5, 0]);
  });

  it("draws a sparkline inside its box, and an idle one along the bottom", () => {
    const path = sparklinePath([0, 10, 5], 100, 20);
    expect(path).toBe("M0 18 L50 2 L100 10");
    expect(sparklinePath([0, 0, 0], 100, 20)).toBe("M0 18 L50 18 L100 18");
    expect(sparklinePath([], 100, 20)).toBe("M0 20 L100 20");
  });
});
