import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { getSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/platform-admin-server", () => ({ isPlatformAdminFresh: async (u: { isPlatformAdmin?: boolean } | null) => u?.isPlatformAdmin === true }));
vi.mock("@/lib/auth/two-factor-policy", () => ({ adminNeedsTwoFactorSetup: async () => false, TWO_FACTOR_REQUIRED_MESSAGE: "Set up two-factor sign-in" }));
const restart = vi.fn();
const audit = vi.fn();
vi.mock("@/lib/admin/worker-control", () => ({ requestWorkerRestart: (...a: unknown[]) => restart(...a) }));
vi.mock("@/lib/admin/audit", () => ({ logAdminAction: (...a: unknown[]) => audit(...a) }));

const params = { params: Promise.resolve({ workerId: "w-1" }) };
const admin = { user: { id: "admin-1", isPlatformAdmin: true } };

describe("POST /api/admin/workers/:workerId/restart", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    restart.mockReset();
    audit.mockReset();
  });

  it("is for platform admins only", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    expect((await POST(new Request("http://x", { method: "POST" }), params)).status).toBe(401);
    vi.mocked(getSession).mockResolvedValue({ user: { id: "u", isPlatformAdmin: false } } as never);
    expect((await POST(new Request("http://x", { method: "POST" }), params)).status).toBe(403);
    expect(restart).not.toHaveBeenCalled();
  });

  it("asks the worker to restart and audits who asked", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    restart.mockResolvedValue({ ok: true, workerId: "w-1", kind: "video-worker", hostname: "vps-1" });
    expect((await POST(new Request("http://x", { method: "POST" }), params)).status).toBe(200);
    expect(restart).toHaveBeenCalledWith("w-1");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin-1", action: "worker.restart_requested", entityId: "w-1", summary: "Asked the video worker on vps-1 to restart" }));
  });

  it("404 for an unknown worker, 400 for one that is not running, and no audit entry for either", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    restart.mockResolvedValue({ ok: false, reason: "not_found", message: "No such worker." });
    expect((await POST(new Request("http://x", { method: "POST" }), params)).status).toBe(404);
    restart.mockResolvedValue({ ok: false, reason: "not_running", message: "not running" });
    expect((await POST(new Request("http://x", { method: "POST" }), params)).status).toBe(400);
    expect(audit).not.toHaveBeenCalled();
  });
});
