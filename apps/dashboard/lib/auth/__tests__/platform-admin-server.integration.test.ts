import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

// The signed-in session as the cookie cache would hand it out: it still says "admin"
let sessionUser: { id: string; isPlatformAdmin: boolean } | null = null;
vi.mock("@/lib/auth/session", () => ({ getSession: async () => (sessionUser ? { user: sessionUser } : null) }));

run("admin access follows the database, not the cached session (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let fresh: typeof import("../platform-admin-server");
  let guard: typeof import("@/lib/admin/guard");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const id = `pa${Date.now()}`;

  const setFlag = (value: boolean) => db.update(s.user).set({ isPlatformAdmin: value }).where(eq(s.user.id, id));

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.REQUIRE_ADMIN_2FA = "false"; // this file is about the admin flag; two-factor is covered in two-factor-policy.test.ts
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    fresh = await import("../platform-admin-server");
    guard = await import("@/lib/admin/guard");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values({ id, name: "PA", email: `${id}@example.test`, isPlatformAdmin: true });
  }, 600_000);

  afterAll(async () => {
    await db.delete(s.user).where(eq(s.user.id, id));
    await pool?.end();
    await releaseLock?.();
  });

  it("reads the flag as it is now", async () => {
    await setFlag(true);
    expect(await fresh.isPlatformAdminFresh({ id })).toBe(true);
    await setFlag(false);
    expect(await fresh.isPlatformAdminFresh({ id })).toBe(false);
  });

  it("an unknown, missing or id-less user is not an admin", async () => {
    expect(await fresh.isPlatformAdminFresh({ id: "nobody-here" })).toBe(false);
    expect(await fresh.isPlatformAdminFresh({})).toBe(false);
    expect(await fresh.isPlatformAdminFresh(null)).toBe(false);
    expect(await fresh.isPlatformAdminFresh(undefined)).toBe(false);
  });

  it("the admin guard refuses someone whose admin access was taken away, even though their cached session still says admin", async () => {
    await setFlag(true);
    sessionUser = { id, isPlatformAdmin: true };
    expect((await guard.requirePlatformAdminApi()).ok).toBe(true);

    await setFlag(false); // an admin revokes them; their cookie still carries isPlatformAdmin: true
    const result = await guard.requirePlatformAdminApi();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("and lets in someone who was just made an admin, before their cached session catches up", async () => {
    await setFlag(true);
    sessionUser = { id, isPlatformAdmin: false };
    expect((await guard.requirePlatformAdminApi()).ok).toBe(true);
  });
});
