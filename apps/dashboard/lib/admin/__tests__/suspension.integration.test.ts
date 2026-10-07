import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("suspending accounts (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let sus: typeof import("../suspension");
  let check: typeof import("@/lib/auth/suspended");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `sus${Date.now()}`;
  const admin = `${tag}-admin`;
  const other = `${tag}-admin2`;
  const person = `${tag}-person`;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    sus = await import("../suspension");
    check = await import("@/lib/auth/suspended");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values([
      { id: admin, name: "Admin", email: `${admin}@example.test`, isPlatformAdmin: true },
      { id: other, name: "Admin 2", email: `${other}@example.test`, isPlatformAdmin: true },
      { id: person, name: "Person", email: `${person}@example.test` },
    ]);
    await db.insert(s.session).values({ id: `${tag}-s1`, token: `${tag}-t1`, userId: person, expiresAt: new Date(Date.now() + 3600_000) });
  }, 600_000);

  afterAll(async () => {
    for (const id of [person, other, admin]) await db.delete(s.user).where(eq(s.user.id, id));
    await pool?.end();
    await releaseLock?.();
  });

  const sessionCount = async () => (await db.select().from(s.session).where(eq(s.session.userId, person))).length;

  it("is not suspended by default, and an unknown or missing user is not either", async () => {
    expect(await check.getSuspension(person)).toEqual({ suspended: false, reason: null });
    expect(await check.getSuspension("nobody")).toEqual({ suspended: false, reason: null });
    expect(await check.getSuspension(undefined)).toEqual({ suspended: false, reason: null });
  });

  it("needs a reason, refuses yourself and another admin, and changes nothing when refused", async () => {
    expect(await sus.setSuspended(admin, person, true, "  ")).toMatchObject({ ok: false, reason: "reason_required" });
    expect(await sus.setSuspended(admin, admin, true, "x")).toMatchObject({ ok: false, reason: "self" });
    expect(await sus.setSuspended(admin, other, true, "x")).toMatchObject({ ok: false, reason: "admin" });
    expect(await sus.setSuspended(admin, "nobody", true, "x")).toMatchObject({ ok: false, reason: "not_found" });
    expect((await check.getSuspension(person)).suspended).toBe(false);
    expect(await sessionCount()).toBe(1);
  });

  it("suspends: the reason is kept and their open sessions are removed at once", async () => {
    expect(await sus.setSuspended(admin, person, true, "Chargeback abuse")).toMatchObject({ ok: true, changed: true });
    expect(await check.getSuspension(person)).toEqual({ suspended: true, reason: "Chargeback abuse" });
    expect(await sessionCount()).toBe(0);
  });

  it("suspending twice changes nothing the second time", async () => {
    expect(await sus.setSuspended(admin, person, true, "Another reason")).toMatchObject({ ok: true, changed: false });
    expect((await check.getSuspension(person)).reason).toBe("Chargeback abuse");
  });

  it("restores, and a restored account has no suspension left", async () => {
    expect(await sus.setSuspended(admin, person, false)).toMatchObject({ ok: true, changed: true });
    expect(await check.getSuspension(person)).toEqual({ suspended: false, reason: null });
    expect(await sus.setSuspended(admin, person, false)).toMatchObject({ ok: true, changed: false });
  });
});
