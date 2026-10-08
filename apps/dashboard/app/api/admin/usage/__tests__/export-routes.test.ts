import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "@/lib/auth/session";
import { GET as usageExport } from "../export/route";
import { GET as auditExport } from "../../audit/export/route";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/platform-admin-server", () => ({ isPlatformAdminFresh: async (u: { isPlatformAdmin?: boolean } | null) => u?.isPlatformAdmin === true }));
vi.mock("@/lib/auth/two-factor-policy", () => ({ adminNeedsTwoFactorSetup: async () => false, TWO_FACTOR_REQUIRED_MESSAGE: "Set up two-factor sign-in" }));

const csv = vi.fn();
vi.mock("@/lib/admin/usage", async (orig) => ({ ...(await orig<typeof import("@/lib/admin/usage")>()), usageCsv: (...a: unknown[]) => csv(...a) }));
const forExport = vi.fn();
vi.mock("@/lib/admin/queries", () => ({ AUDIT_EXPORT_LIMIT: 10000, listAuditForExport: (...a: unknown[]) => forExport(...a) }));
const audit = vi.fn();
vi.mock("@/lib/admin/audit", () => ({ logAdminAction: (...a: unknown[]) => audit(...a) }));

const admin = { user: { id: "a1", email: "a@x.test", isPlatformAdmin: true } };

describe("admin CSV exports", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    csv.mockReset();
    forExport.mockReset();
    audit.mockReset();
  });

  it("refuse anonymous users and ordinary accounts without running a query", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    expect((await usageExport(new Request("http://x/api/admin/usage/export"))).status).toBe(401);
    vi.mocked(getSession).mockResolvedValue({ user: { id: "u", isPlatformAdmin: false } } as never);
    expect((await usageExport(new Request("http://x/api/admin/usage/export"))).status).toBe(403);
    expect((await auditExport(new Request("http://x/api/admin/audit/export"))).status).toBe(403);
    expect(csv).not.toHaveBeenCalled();
    expect(forExport).not.toHaveBeenCalled();
  });

  it("usage: downloads the month by account or by space, never cached, and records the export", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    csv.mockResolvedValue("month\r\n");
    const res = await usageExport(new Request("http://x/api/admin/usage/export?month=2026-09&scope=spaces"));
    expect(res.status).toBe(200);
    expect(csv).toHaveBeenCalledWith("spaces", "2026-09");
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="usage-2026-09-spaces.csv"');
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "a1", action: "export.usage", changes: { month: "2026-09", scope: "spaces" } }));
    await usageExport(new Request("http://x/api/admin/usage/export?scope=other"));
    expect(csv).toHaveBeenLastCalledWith("accounts", expect.stringMatching(/^\d{4}-\d{2}$/));
  });

  it("audit: passes the same filters as the tab, writes the rows, flags a cut file, and records the export", async () => {
    vi.mocked(getSession).mockResolvedValue(admin as never);
    forExport.mockResolvedValue({
      total: 20000,
      truncated: true,
      rows: [{ createdAt: new Date("2026-09-01T00:00:00Z"), actorEmail: null, action: "plan.updated", entityType: "plan", entityId: "p1", summary: "=cmd()", changes: { a: 1 } }],
    });
    const res = await auditExport(new Request("http://x/api/admin/audit/export?q=pro&type=plan&actor=a1&from=2026-09-01&to=2026-09-30"));
    expect(forExport).toHaveBeenCalledWith({ q: "pro", entityType: "plan", actorId: "a1", from: "2026-09-01", to: "2026-09-30" });
    expect(res.headers.get("X-Export-Truncated")).toBe("first 10000 of 20000");
    const text = await res.text();
    expect(text.split("\r\n")[0]).toBe("time_utc,admin,action,entity_type,entity_id,summary,changes");
    expect(text).toContain("Deleted user");
    expect(text).toContain("'=cmd()");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "export.audit", entityType: "export" }));
    // "all" (what the menus send) means no filter
    await auditExport(new Request("http://x/api/admin/audit/export?type=all&actor=all"));
    expect(forExport).toHaveBeenLastCalledWith(expect.objectContaining({ entityType: undefined, actorId: undefined }));
  });
});
