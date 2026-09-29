import { describe, it, expect } from "vitest";
import {
  analyticsQuerySchema,
  resolveDateRange,
} from "../analytics";

describe("analyticsQuerySchema", () => {
  it("applies defaults when no params are provided", () => {
    const result = analyticsQuerySchema.parse({});
    expect(result.type).toBe("overview");
    expect(result.interval).toBe("day");
    expect(result.startDate).toBeUndefined();
    expect(result.endDate).toBeUndefined();
  });

  it("accepts all valid types and intervals", () => {
    const result = analyticsQuerySchema.parse({
      type: "timeseries",
      interval: "week",
    });
    expect(result.type).toBe("timeseries");
    expect(result.interval).toBe("week");
  });

  it("rejects invalid types", () => {
    expect(
      analyticsQuerySchema.safeParse({ type: "bogus" }).success
    ).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(
      analyticsQuerySchema.safeParse({ startDate: "not-a-date" }).success
    ).toBe(false);
    expect(
      analyticsQuerySchema.safeParse({ startDate: "2026-13-45" }).success
    ).toBe(false);
  });

  it("accepts well-formed dates", () => {
    expect(
      analyticsQuerySchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      }).success
    ).toBe(true);
  });
});

describe("resolveDateRange", () => {
  it("uses explicit dates when both are provided", () => {
    const range = resolveDateRange(
      analyticsQuerySchema.parse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      })
    );
    expect(range.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-01-31T23:59:59.999Z");
  });

  it("defaults to last 30 days", () => {
    const before = new Date();
    const range = resolveDateRange(analyticsQuerySchema.parse({}));
    const after = new Date();

    const expectedEnd = 30 * 24 * 60 * 60 * 1000;
    const elapsed = range.start.getTime() - before.getTime();

    // start should be ~30 days ago, end ~now
    expect(elapsed + expectedEnd).toBeLessThan(after.getTime() - before.getTime() + 5000);
    expect(Math.abs(range.end.getTime() - after.getTime())).toBeLessThan(5000);
  });
});
