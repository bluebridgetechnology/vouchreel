import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: (...a: unknown[]) => getSession(...a) }));
vi.mock("@/lib/auth/platform-admin-server", () => ({ isPlatformAdminFresh: async (u: { isPlatformAdmin?: boolean } | null) => u?.isPlatformAdmin === true }));
vi.mock("@/lib/auth/two-factor-policy", () => ({ adminNeedsTwoFactorSetup: async () => false, TWO_FACTOR_REQUIRED_MESSAGE: "Set up two-factor sign-in" }));
const resetTwoFactor = vi.fn();
vi.mock("@/lib/admin/two-factor-reset", () => ({ resetTwoFactor: (...a: unknown[]) => resetTwoFactor(...a) }));
const logAdminAction = vi.fn();
vi.mock("@/lib/admin/audit", () => ({ logAdminAction: (...a: unknown[]) => logAdminAction(...a) }));

import { DELETE } from "../route";

const call = (id = "target") => DELETE(new Request("http://x", { method: "DELETE" }), { params: Promise.resolve({ id }) });

describe("DELETE /api/admin/users/:id/two-factor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { id: "admin-1", isPlatformAdmin: true } });
  });

  it("is for admins only", async () => {
    getSession.mockResolvedValue({ user: { id: "u", isPlatformAdmin: false } });
    expect((await call()).status).toBe(403);
    getSession.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(resetTwoFactor).not.toHaveBeenCalled();
  });

  it("resets and writes an audit entry", async () => {
    resetTwoFactor.mockResolvedValue({ ok: true, email: "lost@example.com", wasEnabled: true });
    expect((await call()).status).toBe(200);
    expect(resetTwoFactor).toHaveBeenCalledWith("admin-1", "target");
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "user.two_factor_reset", entityId: "target", actorId: "admin-1" }));
  });

  it("refuses your own account and unknown accounts, with no audit entry", async () => {
    resetTwoFactor.mockResolvedValue({ ok: false, reason: "self", message: "Ask another admin" });
    expect((await call("admin-1")).status).toBe(400);
    resetTwoFactor.mockResolvedValue({ ok: false, reason: "not_found", message: "User not found" });
    expect((await call("nobody")).status).toBe(404);
    expect(logAdminAction).not.toHaveBeenCalled();
  });
});
