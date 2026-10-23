import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const findMany = vi.fn();
vi.mock("@/lib/db", () => ({ db: { query: { plans: { findMany: (...a: unknown[]) => findMany(...a) } } } }));

const row = (over: Record<string, unknown> = {}) => ({
  id: "plan-1",
  name: "Pro",
  description: "For growing teams",
  badge: "Most popular",
  price: 1900,
  interval: "month",
  features: ["Unlimited spaces", "Remove Vouchreel watermark"],
  limits: { maxSpaces: -1 },
  stripeProductId: "prod_secret",
  stripePriceId: "price_secret",
  dodoProductId: "pdt_secret",
  dodoPriceId: "dodo_secret",
  sortOrder: 10,
  isActive: true,
  isCustom: false,
  createdAt: new Date("2026-01-01"),
  ...over,
});

beforeEach(() => findMany.mockReset());

describe("GET /api/plans", () => {
  it("returns the active plans with their price in cents and feature lines", async () => {
    findMany.mockResolvedValue([row(), row({ id: "plan-2", name: "Free", price: 0, badge: null, features: ["1 space"] })]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plans.map((p: { name: string; price: number }) => [p.name, p.price])).toEqual([["Pro", 1900], ["Free", 0]]);
    expect(body.plans[0].features).toEqual(["Unlimited spaces", "Remove Vouchreel watermark"]);
  });

  it("never exposes payment-provider ids or plan limits", async () => {
    findMany.mockResolvedValue([row()]);
    const text = JSON.stringify(await (await GET()).json());
    expect(text).not.toMatch(/secret|stripe|dodo|limits/i);
  });

  it("is not cached, so an admin's change shows at once", async () => {
    findMany.mockResolvedValue([]);
    expect((await GET()).headers.get("Cache-Control")).toBe("no-store");
  });

  it("answers with a server error, not a crash, when the database fails", async () => {
    findMany.mockRejectedValueOnce(new Error("db down"));
    expect((await GET()).status).toBe(500);
  });
});
