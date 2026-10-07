import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("two-factor reset (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let s: typeof import("@/lib/db/schema");
  let eq: typeof import("drizzle-orm").eq;
  let reset: typeof import("../two-factor-reset");
  let releaseLock: (() => Promise<void>) | undefined;
  const stamp = Date.now();
  const admin = `tf-admin-${stamp}`;
  const member = `tf-member-${stamp}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    reset = await import("../two-factor-reset");
    await db.insert(s.user).values([
      { id: admin, name: "TF Admin", email: `${admin}@example.test`, isPlatformAdmin: true, twoFactorEnabled: true },
      { id: member, name: "TF Member", email: `${member}@example.test`, twoFactorEnabled: true },
    ]);
    await db.insert(s.twoFactor).values({ id: `tf-${stamp}`, secret: "x", backupCodes: "y", userId: member });
  }, 60_000);

  afterAll(async () => {
    await db.delete(s.user).where(eq(s.user.id, admin));
    await db.delete(s.user).where(eq(s.user.id, member));
    await releaseLock?.();
  });

  it("refuses to reset your own account", async () => {
    expect(await reset.resetTwoFactor(admin, admin)).toMatchObject({ ok: false, reason: "self" });
    const [row] = await db.select({ on: s.user.twoFactorEnabled }).from(s.user).where(eq(s.user.id, admin));
    expect(row.on).toBe(true);
  });

  it("reports an unknown account", async () => {
    expect(await reset.resetTwoFactor(admin, "nobody")).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("turns it off for someone else and removes their secret and backup codes", async () => {
    expect(await reset.resetTwoFactor(admin, member)).toMatchObject({ ok: true, wasEnabled: true });
    const [row] = await db.select({ on: s.user.twoFactorEnabled }).from(s.user).where(eq(s.user.id, member));
    expect(row.on).toBe(false);
    expect(await db.select().from(s.twoFactor).where(eq(s.twoFactor.userId, member))).toHaveLength(0);
  });
});
