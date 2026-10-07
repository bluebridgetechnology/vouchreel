import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";
import { POST } from "../[id]/route";
import { getSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/platform-admin-server", () => ({ isPlatformAdminFresh: async (u: { isPlatformAdmin?: boolean } | null) => u?.isPlatformAdmin === true }));

const overview = { byStatus: { queued: 0, running: 0, done: 0, failed: 0 }, byType: [], oldestQueuedAt: null, staleRunning: 0, failed: [], active: [] };
const job = { id: "j1", type: "review_video", videoId: "v1" };
const retryJob = vi.fn();
const cancelJob = vi.fn();
const audit = vi.fn();

vi.mock("@/lib/admin/jobs", () => ({
  getJobOverview: async () => overview,
  listAdminVideos: async () => [],
  retryJob: (...a: unknown[]) => retryJob(...a),
  cancelJob: (...a: unknown[]) => cancelJob(...a),
}));
vi.mock("@/lib/admin/audit", () => ({ logAdminAction: (...a: unknown[]) => audit(...a) }));

const admin = { user: { id: "u1", email: "a@x.test", isPlatformAdmin: true } };
const params = (id = "j1") => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) => new Request("http://x/api/admin/jobs/j1", { method: "POST", body: JSON.stringify(body) });

describe("/api/admin/jobs", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    retryJob.mockReset();
    cancelJob.mockReset();
    audit.mockReset();
  });

  it("rejects anonymous users and ordinary accounts", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    expect((await GET()).status).toBe(401);
    expect((await POST(post({ action: "retry" }), params())).status).toBe(401);

    vi.mocked(getSession).mockResolvedValue({ user: { id: "u2", email: "b@x.test", role: "owner", isPlatformAdmin: false } } as never);
    expect((await GET()).status).toBe(403);
    expect((await POST(post({ action: "cancel" }), params())).status).toBe(403);
    expect(retryJob).not.toHaveBeenCalled();
    expect(cancelJob).not.toHaveBeenCalled();
  });

  it("returns the overview to a platform admin", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).overview.byStatus.failed).toBe(0);
  });

  it("validates the action", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    expect((await POST(post({ action: "delete" }), params())).status).toBe(400);
    expect((await POST(post(null), params())).status).toBe(400);
  });

  it("retries, then writes an audit entry", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    retryJob.mockResolvedValue({ ok: true, job });
    const res = await POST(post({ action: "retry" }), params());
    expect(res.status).toBe(200);
    expect(retryJob).toHaveBeenCalledWith("j1");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "u1", action: "job.retry", entityType: "job", entityId: "j1" }));
  });

  it("maps not found and invalid state, and does not audit a failed action", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    cancelJob.mockResolvedValueOnce({ ok: false, reason: "not_found", message: "Job not found." });
    expect((await POST(post({ action: "cancel" }), params())).status).toBe(404);
    cancelJob.mockResolvedValueOnce({ ok: false, reason: "invalid_state", message: "It is running normally." });
    expect((await POST(post({ action: "cancel" }), params())).status).toBe(400);
    expect(audit).not.toHaveBeenCalled();
  });
});
