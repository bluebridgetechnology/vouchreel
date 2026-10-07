import { describe, expect, it, vi } from "vitest";

// usage.ts imports the database module; these tests only use its pure helpers
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/payments/subscription", () => ({ getSubscriptionLimits: vi.fn() }));
import { formatLimit, formatUsd, limitState, parseMonth, shiftMonth } from "../usage";

describe("usage helpers", () => {
  it("parses a month, falling back to the current UTC month", () => {
    const now = new Date("2026-10-15T23:30:00Z");
    expect(parseMonth("2026-03", now)).toMatchObject({ month: "2026-03", from: new Date("2026-03-01T00:00:00Z"), to: new Date("2026-04-01T00:00:00Z") });
    expect(parseMonth("2026-12", now).to).toEqual(new Date("2027-01-01T00:00:00Z"));
    for (const bad of [undefined, "", "2026-13", "2026-00", "26-03", "2026-3", "march", "2026-03-01"]) {
      expect(parseMonth(bad, now).month).toBe("2026-10");
    }
  });

  it("moves between months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-05", 0)).toBe("2026-05");
  });

  it("compares use with the allowance", () => {
    expect(limitState(0, 10)).toBe("none");
    expect(limitState(4, 10)).toBe("ok");
    expect(limitState(10, 10)).toBe("at");
    expect(limitState(11, 10)).toBe("over");
    expect(limitState(500, Infinity)).toBe("unlimited");
    expect(limitState(0, 0)).toBe("not_in_plan");
    expect(limitState(1, 0)).toBe("over"); // used a feature the plan does not include
  });

  it("formats limits and money", () => {
    expect(formatLimit(Infinity)).toBe("unlimited");
    expect(formatLimit(20)).toBe("20");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(1234)).toBe("$12.34");
  });
});
