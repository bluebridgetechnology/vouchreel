import { describe, expect, it } from "vitest";
import { PLAN_LIMIT_PRESETS, formatLimit, normalizeLimits, serializeLimits, tierFromName } from "../plan-limits";

describe("plan limits", () => {
  it("treats -1 as unlimited (Infinity) and keeps caps as numbers", () => {
    const limits = normalizeLimits({ maxSpaces: -1, maxTestimonialsPerSpace: 25, removeWatermark: true }, "Custom");
    expect(limits.maxSpaces).toBe(Infinity);
    expect(limits.maxTestimonialsPerSpace).toBe(25);
    expect(limits.removeWatermark).toBe(true);
  });

  it("DB values override presets, even when stricter than the tier name suggests", () => {
    const limits = normalizeLimits({ maxSpaces: 2, maxTestimonialsPerSpace: 10 }, "Agency");
    expect(limits.maxSpaces).toBe(2);
    expect(limits.maxTestimonialsPerSpace).toBe(10);
  });

  it("falls back to name-based presets for legacy plans without stored limits", () => {
    expect(normalizeLimits(null, "Pro")).toEqual(PLAN_LIMIT_PRESETS.pro);
    expect(normalizeLimits(undefined, "Agency Monthly")).toEqual(PLAN_LIMIT_PRESETS.agency);
    expect(normalizeLimits(null, "Starter")).toEqual(PLAN_LIMIT_PRESETS.free);
    expect(tierFromName("Business")).toBe("business");
  });

  it("ignores malformed stored values instead of breaking gating", () => {
    const limits = normalizeLimits({ maxSpaces: "lots", maxTestimonialsPerSpace: null, multiSeat: "yes" }, "Free");
    expect(limits.maxSpaces).toBe(PLAN_LIMIT_PRESETS.free.maxSpaces);
    expect(limits.maxTestimonialsPerSpace).toBe(PLAN_LIMIT_PRESETS.free.maxTestimonialsPerSpace);
    expect(limits.multiSeat).toBe(false);
  });

  it("round-trips through the JSON-safe stored form", () => {
    const stored = serializeLimits(PLAN_LIMIT_PRESETS.agency);
    expect(stored.maxSpaces).toBe(-1);
    expect(JSON.parse(JSON.stringify(stored))).toEqual(stored);
    expect(normalizeLimits(stored, "Agency")).toEqual(PLAN_LIMIT_PRESETS.agency);
  });

  it("formats limits for messages", () => {
    expect(formatLimit(3)).toBe("3");
    expect(formatLimit(Infinity)).toBe("Unlimited");
  });
});
