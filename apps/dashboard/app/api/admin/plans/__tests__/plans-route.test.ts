import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[id]/route";
import { getSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/platform-admin-server", () => ({ isPlatformAdminFresh: async (u: { isPlatformAdmin?: boolean } | null) => u?.isPlatformAdmin === true }));
vi.mock("@/lib/auth/two-factor-policy", () => ({ adminNeedsTwoFactorSetup: async () => false, TWO_FACTOR_REQUIRED_MESSAGE: "Set up two-factor sign-in" }));

const inserted = vi.fn();
const insertResult = vi.fn();
const updated = vi.fn();
const selectQueue: unknown[][] = [];

vi.mock("@/lib/db", () => {
  const chain = () => {
    const c: Record<string, unknown> = {};
    c.from = () => c;
    c.where = () => c;
    c.groupBy = () => c;
    c.orderBy = () => c;
    c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(selectQueue.shift() ?? []).then(resolve);
    return c;
  };
  return {
    db: {
      select: () => chain(),
      insert: () => ({
        values: (v: unknown) => {
          inserted(v);
          return Object.assign(Promise.resolve(), { returning: () => Promise.resolve([insertResult(v)]) });
        },
      }),
      update: () => ({
        set: (v: unknown) => ({ where: () => ({ returning: () => Promise.resolve([updated(v)].filter(Boolean)) }) }),
      }),
    },
  };
});

const row = (over: Record<string, unknown> = {}) => ({
  id: "plan-1",
  name: "Starter",
  description: null,
  badge: null,
  price: 900,
  interval: "month",
  features: [],
  limits: null,
  stripeProductId: null,
  stripePriceId: null,
  dodoProductId: null,
  dodoPriceId: null,
  sortOrder: 0,
  isActive: true,
  isCustom: false,
  createdAt: new Date("2026-01-01"),
  ...over,
});

const body = {
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

const req = (method: string, payload?: unknown) =>
  new Request("http://localhost/api/admin/plans", {
    method,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
const ctx = { params: Promise.resolve({ id: "plan-1" }) };

describe("admin plans API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
  });

  it("401 without a session, 403 for customers (even role=owner)", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    expect((await GET()).status).toBe(401);
    vi.mocked(getSession).mockResolvedValue({ user: { id: "u1", role: "owner", isPlatformAdmin: false } } as never);
    expect((await GET()).status).toBe(403);
    expect((await POST(req("POST", body))).status).toBe(403);
    expect((await PATCH(req("PATCH", { price: 1 }), ctx)).status).toBe(403);
    expect((await DELETE(req("DELETE"), ctx)).status).toBe(403);
    expect(inserted).not.toHaveBeenCalled();
    expect(updated).not.toHaveBeenCalled();
  });

  describe("as platform admin", () => {
    beforeEach(() => {
      vi.mocked(getSession).mockResolvedValue({ user: { id: "admin-1", isPlatformAdmin: true } } as never);
    });

    it("creates a plan with validated limits and writes an audit entry", async () => {
      insertResult.mockImplementation((v) => row(v as Record<string, unknown>));
      const res = await POST(req("POST", body));
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.plan.limits.maxSpaces).toBe(2);
      expect(json.plan.limits.maxTestimonialsPerSpace).toBe(-1);
      expect(inserted.mock.calls.some(([v]) => (v as { action?: string }).action === "plan.created")).toBe(true);
    });

    it("rejects invalid plans with 400", async () => {
      const res = await POST(req("POST", { ...body, price: -5 }));
      expect(res.status).toBe(400);
    });

    it("patches a plan and records only the changed fields", async () => {
      selectQueue.push([row()], [{ planId: "plan-1", value: 4 }]);
      updated.mockImplementation((v) => row(v as Record<string, unknown>));
      const res = await PATCH(req("PATCH", { price: 1200 }), ctx);
      expect(res.status).toBe(200);
      expect((await res.json()).plan.price).toBe(1200);
      const audit = inserted.mock.calls
        .map(([v]) => v as { action?: string; changes?: Record<string, unknown> })
        .find((v) => v.action === "plan.updated");
      expect(audit?.changes).toEqual({ price: { from: 900, to: 1200 } });
    });

    it("404s when patching a missing plan and rejects empty bodies", async () => {
      selectQueue.push([]);
      expect((await PATCH(req("PATCH", { price: 1 }), ctx)).status).toBe(404);
      expect((await PATCH(req("PATCH", {}), ctx)).status).toBe(400);
    });

    it("archives instead of deleting", async () => {
      updated.mockImplementation((v) => row(v as Record<string, unknown>));
      selectQueue.push([{ planId: "plan-1", value: 2 }]);
      const res = await DELETE(req("DELETE"), ctx);
      expect(res.status).toBe(200);
      expect(updated).toHaveBeenCalledWith({ isActive: false });
    });
  });
});
