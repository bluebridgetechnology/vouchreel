import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../route";
import { getSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/platform-admin-server", () => ({ isPlatformAdminFresh: async (u: { isPlatformAdmin?: boolean } | null) => u?.isPlatformAdmin === true }));
vi.mock("@/lib/auth/two-factor-policy", () => ({ adminNeedsTwoFactorSetup: async () => false, TWO_FACTOR_REQUIRED_MESSAGE: "Set up two-factor sign-in" }));

const add = vi.fn();
const list = vi.fn();
const audit = vi.fn();
vi.mock("@/lib/admin/credit-adjustments", () => ({
  MAX_ADJUSTMENT: 1000,
  addAdjustment: (...a: unknown[]) => add(...a),
  listAdjustments: (...a: unknown[]) => list(...a),
}));
vi.mock("@/lib/admin/audit", () => ({ logAdminAction: (...a: unknown[]) => audit(...a) }));

const admin = { user: { id: "admin-1", isPlatformAdmin: true } };
const params = { params: Promise.resolve({ id: "user-2" }) };
const post = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });

describe("/api/admin/users/:id/credits", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    add.mockReset();
    list.mockReset();
    audit.mockReset();
  });

  it("is for platform admins only", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    expect((await POST(post({ kind: "ai", amount: 1, reason: "x" }), params)).status).toBe(401);
    expect((await GET(new Request("http://x"), params)).status).toBe(401);
    vi.mocked(getSession).mockResolvedValue({ user: { id: "u", isPlatformAdmin: false } } as never);
    expect((await POST(post({ kind: "ai", amount: 1, reason: "x" }), params)).status).toBe(403);
    expect(add).not.toHaveBeenCalled();
  });

  it("validates kind, amount and reason", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    for (const body of [null, {}, { kind: "x", amount: 1, reason: "r" }, { kind: "ai", amount: 0, reason: "r" }, { kind: "ai", amount: 1.5, reason: "r" }, { kind: "ai", amount: 5000, reason: "r" }, { kind: "ai", amount: 1, reason: "  " }]) {
      expect((await POST(post(body), params)).status).toBe(400);
    }
    expect(add).not.toHaveBeenCalled();
  });

  it("records the adjustment and one audit entry", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    add.mockResolvedValue({ ok: true, id: "adj-1", email: "b@x.test" });
    const res = await POST(post({ kind: "ai", amount: -2, reason: "Refund" }), params);
    expect(res.status).toBe(200);
    expect(add).toHaveBeenCalledWith("admin-1", "user-2", { kind: "ai", amount: -2, reason: "Refund" });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "user.credits_adjusted", entityId: "user-2", summary: "Removed 2 AI video credits for b@x.test" }));
  });

  it("an unknown user is 404 and nothing is audited", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    add.mockResolvedValue({ ok: false, reason: "not_found", message: "User not found." });
    expect((await POST(post({ kind: "review", amount: 1, reason: "r" }), params)).status).toBe(404);
    expect(audit).not.toHaveBeenCalled();
  });

  it("lists this month's adjustments", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    list.mockResolvedValue([{ id: "a" }]);
    const res = await GET(new Request("http://x"), params);
    expect((await res.json()).adjustments).toHaveLength(1);
  });
});
