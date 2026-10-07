import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { DEFAULT_PLANS } from "./seed-plans";

describe("seeded plans", () => {
  it("every active paid plan is sold monthly and yearly, with distinct price ids", () => {
    const paid = DEFAULT_PLANS.filter((p) => p.isActive && p.price > 0);
    for (const name of new Set(paid.map((p) => p.name))) {
      const intervals = paid.filter((p) => p.name === name).map((p) => p.interval).sort();
      expect(intervals, `${name} intervals`).toEqual(["month", "year"]);
    }
    const priceIds = paid.map((p) => p.stripePriceId);
    expect(new Set(priceIds).size).toBe(priceIds.length);
  });
});
