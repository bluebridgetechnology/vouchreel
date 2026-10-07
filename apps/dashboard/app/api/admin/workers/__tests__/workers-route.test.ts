import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";
import { getSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/platform-admin-server", () => ({ isPlatformAdminFresh: async (u: { isPlatformAdmin?: boolean } | null) => u?.isPlatformAdmin === true }));
const health = vi.fn();
vi.mock("@/lib/admin/workers", () => ({ getWorkerHealth: () => health() }));

describe("GET /api/admin/workers", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    health.mockReset();
  });

  it("rejects anonymous users and ordinary accounts", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    expect((await GET()).status).toBe(401);
    vi.mocked(getSession).mockResolvedValue({ user: { id: "u", isPlatformAdmin: false, role: "owner" } } as never);
    expect((await GET()).status).toBe(403);
    expect(health).not.toHaveBeenCalled();
  });

  it("returns the health report to a platform admin, and a 500 when it fails", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "a", isPlatformAdmin: true } } as never);
    health.mockResolvedValueOnce({ workers: [], kinds: [{ kind: "worker", severity: "ok" }] });
    const ok = await GET();
    expect(ok.status).toBe(200);
    expect((await ok.json()).kinds[0].kind).toBe("worker");
    health.mockRejectedValueOnce(new Error("db down"));
    expect((await GET()).status).toBe(500);
  });
});
