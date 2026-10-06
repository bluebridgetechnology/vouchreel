import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "../[id]/route";
import { getSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

const update = vi.fn();
const audit = vi.fn();
vi.mock("@/lib/admin/users", () => ({ updateAdminUser: (...a: unknown[]) => update(...a) }));
vi.mock("@/lib/admin/audit", () => ({ logAdminAction: (...a: unknown[]) => audit(...a) }));

const admin = { user: { id: "admin-1", email: "a@x.test", isPlatformAdmin: true } };
const PLAN = "11111111-1111-4111-8111-111111111111";
const params = { params: Promise.resolve({ id: "user-2" }) };
const patch = (body: unknown) => new Request("http://x/api/admin/users/user-2", { method: "PATCH", body: JSON.stringify(body) });

describe("PATCH /api/admin/users/:id", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    update.mockReset();
    audit.mockReset();
  });

  it("rejects anonymous users and ordinary accounts without touching anything", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    expect((await PATCH(patch({ isPlatformAdmin: true }), params)).status).toBe(401);
    vi.mocked(getSession).mockResolvedValue({ user: { id: "u", isPlatformAdmin: false, role: "owner" } } as never);
    expect((await PATCH(patch({ isPlatformAdmin: true }), params)).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("validates the body", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    for (const body of [{}, null, { planId: "not-a-uuid" }, { isPlatformAdmin: "yes" }]) {
      expect((await PATCH(patch(body), params)).status).toBe(400);
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("applies a change, passing the acting admin, and writes one audit entry", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    update.mockResolvedValue({ ok: true, email: "b@x.test", changes: { plan: { from: null, to: "Pro" } } });
    const res = await PATCH(patch({ planId: PLAN }), params);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith("admin-1", "user-2", { planId: PLAN });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin-1", action: "user.updated", entityId: "user-2", summary: "Changed plan for b@x.test" }));
  });

  it("describes admin grants and revokes in the audit summary", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    update.mockResolvedValue({ ok: true, email: "b@x.test", changes: { isPlatformAdmin: { from: false, to: true } } });
    await PATCH(patch({ isPlatformAdmin: true }), params);
    expect(audit.mock.calls[0][0].summary).toBe("Granted admin for b@x.test");
  });

  it("maps refusals to 404 / 400 and records nothing", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    update.mockResolvedValueOnce({ ok: false, reason: "not_found", message: "User not found." });
    expect((await PATCH(patch({ planId: null }), params)).status).toBe(404);
    update.mockResolvedValueOnce({ ok: false, reason: "plan_not_found", message: "Plan not found." });
    expect((await PATCH(patch({ planId: PLAN }), params)).status).toBe(404);
    for (const reason of ["self", "billed_by_provider", "nothing_to_change"]) {
      update.mockResolvedValueOnce({ ok: false, reason, message: reason });
      expect((await PATCH(patch({ planId: null }), params)).status).toBe(400);
    }
    expect(audit).not.toHaveBeenCalled();
  });
});
