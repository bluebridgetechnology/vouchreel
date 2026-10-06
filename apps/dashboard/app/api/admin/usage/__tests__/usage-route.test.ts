import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";
import { getSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/platform-admin-server", () => ({ isPlatformAdminFresh: async (u: { isPlatformAdmin?: boolean } | null) => u?.isPlatformAdmin === true }));

const report = vi.fn();
vi.mock("@/lib/admin/usage", () => ({ getUsageReport: (...a: unknown[]) => report(...a) }));

const admin = { user: { id: "a1", email: "a@x.test", isPlatformAdmin: true } };
const get = (qs = "") => new Request(`http://x/api/admin/usage${qs}`);

describe("GET /api/admin/usage", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    report.mockReset();
  });

  it("rejects anonymous users and ordinary accounts without running the query", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    expect((await GET(get())).status).toBe(401);
    vi.mocked(getSession).mockResolvedValue({ user: { id: "u", isPlatformAdmin: false, role: "owner" } } as never);
    expect((await GET(get())).status).toBe(403);
    expect(report).not.toHaveBeenCalled();
  });

  it("passes the month and page through, and returns unlimited allowances as null", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    report.mockResolvedValue({
      month: "2026-09",
      totals: {},
      totalAccounts: 1,
      page: 2,
      pageSize: 25,
      accounts: [{ ownerId: "o1", reviewLimit: Infinity, aiLimit: 10 }],
    });
    const res = await GET(get("?month=2026-09&page=2"));
    expect(res.status).toBe(200);
    expect(report).toHaveBeenCalledWith("2026-09", 2);
    const body = await res.json();
    expect(body.accounts[0]).toMatchObject({ reviewLimit: null, aiLimit: 10 });
  });

  it("defaults the month and page when they are missing or not numbers", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    report.mockResolvedValue({ month: "x", totals: {}, accounts: [], totalAccounts: 0, page: 1, pageSize: 25 });
    await GET(get("?page=abc"));
    expect(report).toHaveBeenCalledWith(undefined, 1);
  });

  it("reports a failure as a 500 error body", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    report.mockRejectedValue(new Error("db down"));
    const res = await GET(get());
    expect(res.status).toBe(500);
  });
});
