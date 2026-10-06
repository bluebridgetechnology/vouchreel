import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";
import { POST } from "../[kind]/[id]/route";
import { getSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

const list = vi.fn();
const takeDown = vi.fn();
const audit = vi.fn();
vi.mock("@/lib/admin/moderation", () => ({
  REASON_MIN: 5,
  REASON_MAX: 500,
  listModerationItems: (...a: unknown[]) => list(...a),
  takeDownVideo: (...a: unknown[]) => takeDown(...a),
}));
vi.mock("@/lib/admin/audit", () => ({ logAdminAction: (...a: unknown[]) => audit(...a) }));

const admin = { user: { id: "admin-1", email: "a@x.test", isPlatformAdmin: true } };
const ID = "11111111-1111-4111-8111-111111111111";
const ctx = (kind = "ai", id = ID) => ({ params: Promise.resolve({ kind, id }) });
const post = (body: unknown) => new Request("http://x/api/admin/moderation/ai/id", { method: "POST", body: JSON.stringify(body) });
const ok = { ok: true, kind: "ai", id: ID, spaceId: "sp", ownerEmail: "o@x.test", template: "bold" };

describe("/api/admin/moderation", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    list.mockReset();
    takeDown.mockReset();
    audit.mockReset();
  });

  it("rejects anonymous users and ordinary accounts before doing anything", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    expect((await GET(new Request("http://x/api/admin/moderation"))).status).toBe(401);
    expect((await POST(post({ reason: "valid reason" }), ctx())).status).toBe(401);
    vi.mocked(getSession).mockResolvedValue({ user: { id: "u", isPlatformAdmin: false, role: "owner" } } as never);
    expect((await GET(new Request("http://x/api/admin/moderation"))).status).toBe(403);
    expect((await POST(post({ reason: "valid reason" }), ctx())).status).toBe(403);
    expect(list).not.toHaveBeenCalled();
    expect(takeDown).not.toHaveBeenCalled();
  });

  it("lists with validated filters, ignoring unknown values", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    list.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 25 });
    expect((await GET(new Request("http://x/api/admin/moderation?kind=review&filter=attention&q=bob&page=2"))).status).toBe(200);
    expect(list).toHaveBeenLastCalledWith({ kind: "review", filter: "attention", q: "bob" }, 2);
    await GET(new Request("http://x/api/admin/moderation?kind=bogus&filter=nope&page=x"));
    expect(list).toHaveBeenLastCalledWith({ kind: "all", filter: "all", q: undefined }, 1);
  });

  it("requires a real kind, a uuid and a reason of sensible length", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    expect((await POST(post({ reason: "valid reason" }), ctx("movie"))).status).toBe(404);
    expect((await POST(post({ reason: "valid reason" }), ctx("ai", "not-a-uuid"))).status).toBe(404);
    for (const body of [{}, null, { reason: "no" }, { reason: "   " }, { reason: "x".repeat(501) }, { reason: 5 }]) {
      expect((await POST(post(body), ctx())).status).toBe(400);
    }
    expect(takeDown).not.toHaveBeenCalled();
  });

  it("takes the video down as the acting admin and writes one audit entry with the reason", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    takeDown.mockResolvedValue(ok);
    const res = await POST(post({ reason: "  Customer asked for removal  " }), ctx());
    expect(res.status).toBe(200);
    expect(takeDown).toHaveBeenCalledWith("ai", ID, "admin-1", "Customer asked for removal");
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", action: "video.taken_down", entityType: "video", entityId: ID, changes: { kind: "ai", spaceId: "sp", reason: "Customer asked for removal" } })
    );
  });

  it("maps outcomes to status codes and records nothing when it did not happen", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    const body = post({ reason: "valid reason" });
    takeDown.mockResolvedValueOnce({ ok: false, reason: "not_found", message: "Video not found." });
    expect((await POST(body, ctx())).status).toBe(404);
    for (const reason of ["already_removed", "no_file", "cannot_locate_file"]) {
      takeDown.mockResolvedValueOnce({ ok: false, reason, message: reason });
      expect((await POST(post({ reason: "valid reason" }), ctx())).status).toBe(400);
    }
    takeDown.mockResolvedValueOnce({ ok: false, reason: "storage_failed", message: "bucket down" });
    const failed = await POST(post({ reason: "valid reason" }), ctx());
    expect(failed.status).toBe(502);
    expect((await failed.json()).error.message).toBe("bucket down");
    takeDown.mockRejectedValueOnce(new Error("boom"));
    expect((await POST(post({ reason: "valid reason" }), ctx())).status).toBe(500);
    expect(audit).not.toHaveBeenCalled();
  });
});
