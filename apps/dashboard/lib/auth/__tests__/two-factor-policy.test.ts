import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rows: { isPlatformAdmin: boolean; twoFactorEnabled: boolean | null }[] = [];
vi.mock("@/lib/db", () => ({ db: { select: () => ({ from: () => ({ where: async () => rows }) }) } }));

import { adminNeedsTwoFactorSetup, adminTwoFactorRequired } from "../two-factor-policy";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { getSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/platform-admin-server", () => ({ isPlatformAdminFresh: async () => true }));

describe("admin two-factor policy", () => {
  beforeEach(() => {
    rows.length = 0;
    delete process.env.REQUIRE_ADMIN_2FA;
  });
  afterEach(() => {
    delete process.env.REQUIRE_ADMIN_2FA;
  });

  it("is required unless switched off with REQUIRE_ADMIN_2FA=false", () => {
    expect(adminTwoFactorRequired()).toBe(true);
    process.env.REQUIRE_ADMIN_2FA = "false";
    expect(adminTwoFactorRequired()).toBe(false);
  });

  it("asks an admin without two-factor to set it up, and nobody else", async () => {
    rows.push({ isPlatformAdmin: true, twoFactorEnabled: false });
    expect(await adminNeedsTwoFactorSetup({ id: "u1" })).toBe(true);
    rows[0] = { isPlatformAdmin: true, twoFactorEnabled: null };
    expect(await adminNeedsTwoFactorSetup({ id: "u1" })).toBe(true);
    rows[0] = { isPlatformAdmin: true, twoFactorEnabled: true };
    expect(await adminNeedsTwoFactorSetup({ id: "u1" })).toBe(false);
    rows[0] = { isPlatformAdmin: false, twoFactorEnabled: false };
    expect(await adminNeedsTwoFactorSetup({ id: "u1" })).toBe(false);
    expect(await adminNeedsTwoFactorSetup(null)).toBe(false);
    rows.length = 0;
    expect(await adminNeedsTwoFactorSetup({ id: "missing" })).toBe(false);
  });

  it("does nothing when the rule is switched off", async () => {
    process.env.REQUIRE_ADMIN_2FA = "false";
    rows.push({ isPlatformAdmin: true, twoFactorEnabled: false });
    expect(await adminNeedsTwoFactorSetup({ id: "u1" })).toBe(false);
  });

  it("closes the admin API (403) for an admin who has not set it up, and opens it once they have", async () => {
    (getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "u1" } });
    rows.push({ isPlatformAdmin: true, twoFactorEnabled: false });
    const closed = await requirePlatformAdminApi();
    expect(closed.ok).toBe(false);
    if (!closed.ok) expect(closed.response.status).toBe(403);
    rows[0] = { isPlatformAdmin: true, twoFactorEnabled: true };
    expect((await requirePlatformAdminApi()).ok).toBe(true);
  });
});
