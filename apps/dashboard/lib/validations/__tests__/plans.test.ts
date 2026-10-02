import { describe, expect, it } from "vitest";
import { createPlanSchema, updatePlanSchema } from "../plans";

const valid = {
  name: "Starter",
  price: 900,
  interval: "month",
  limits: {
    tier: "custom",
    maxSpaces: 2,
    maxTestimonialsPerSpace: -1,
    removeWatermark: false,
    canCustomizeBranding: true,
    canUseAllTriggers: false,
    canAccessAnalytics: true,
    canUseCustomRules: false,
    multiSeat: false,
    whiteLabel: false,
    exportableReports: false,
  },
};

describe("plan validation", () => {
  it("accepts a valid plan and applies defaults", () => {
    const parsed = createPlanSchema.parse(valid);
    expect(parsed.features).toEqual([]);
    expect(parsed.isActive).toBe(true);
    expect(parsed.sortOrder).toBe(0);
    expect(parsed.stripePriceId).toBeNull();
  });

  it("rejects negative or fractional prices and bad intervals", () => {
    expect(createPlanSchema.safeParse({ ...valid, price: -1 }).success).toBe(false);
    expect(createPlanSchema.safeParse({ ...valid, price: 9.99 }).success).toBe(false);
    expect(createPlanSchema.safeParse({ ...valid, interval: "week" }).success).toBe(false);
  });

  it("rejects limits below -1 and wrongly typed flags", () => {
    expect(createPlanSchema.safeParse({ ...valid, limits: { ...valid.limits, maxSpaces: -2 } }).success).toBe(false);
    expect(createPlanSchema.safeParse({ ...valid, limits: { ...valid.limits, multiSeat: "yes" } }).success).toBe(false);
  });

  it("normalises blank provider ids to null", () => {
    expect(createPlanSchema.parse({ ...valid, stripePriceId: "  ", dodoPriceId: "price_1" })).toMatchObject({
      stripePriceId: null,
      dodoPriceId: "price_1",
    });
  });

  it("allows partial updates", () => {
    expect(updatePlanSchema.parse({ price: 1200 })).toEqual({ price: 1200 });
    expect(updatePlanSchema.safeParse({ price: -5 }).success).toBe(false);
  });
});
