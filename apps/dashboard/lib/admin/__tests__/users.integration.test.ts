import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("admin user management (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let users: typeof import("../users");
  let queries: typeof import("../queries");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `adm-users-${Date.now()}`;
  const ids = { actor: `${tag}-actor`, target: `${tag}-target`, other: `${tag}-other`, pro: "", team: "" };

  const subOf = async (userId: string) => (await db.select().from(s.subscriptions).where(eq(s.subscriptions.userId, userId)))[0];
  const adminFlag = async (userId: string) => (await db.select().from(s.user).where(eq(s.user.id, userId)))[0].isPlatformAdmin;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    users = await import("../users");
    queries = await import("../queries");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;

    await db.insert(s.user).values([
      { id: ids.actor, name: "Actor", email: `${ids.actor}@example.test`, isPlatformAdmin: true },
      { id: ids.target, name: "Target", email: `${ids.target}@example.test` },
      { id: ids.other, name: "Other", email: `${ids.other}@example.test` },
    ]);
    const [pro, team] = await db
      .insert(s.plans)
      .values([
        { name: `${tag} Pro`, price: 1900, interval: "month" },
        { name: `${tag} Team`, price: 4900, interval: "month" },
      ])
      .returning();
    ids.pro = pro.id;
    ids.team = team.id;
  }, 600_000);

  beforeEach(async () => {
    await db.delete(s.subscriptions).where(inArray(s.subscriptions.userId, [ids.actor, ids.target, ids.other]));
    await db.update(s.user).set({ isPlatformAdmin: false }).where(inArray(s.user.id, [ids.target, ids.other]));
    await db.update(s.user).set({ isPlatformAdmin: true }).where(eq(s.user.id, ids.actor));
  });

  afterAll(async () => {
    await db.delete(s.subscriptions).where(inArray(s.subscriptions.userId, [ids.actor, ids.target, ids.other]));
    await db.delete(s.plans).where(inArray(s.plans.id, [ids.pro, ids.team]));
    await db.delete(s.user).where(inArray(s.user.id, [ids.actor, ids.target, ids.other]));
    await pool?.end();
    await releaseLock?.();
  });

  it("grants a plan by hand, then switches it without creating a second subscription", async () => {
    const granted = await users.updateAdminUser(ids.actor, ids.target, { planId: ids.pro });
    expect(granted).toMatchObject({ ok: true, changes: { plan: { from: null, to: `${tag} Pro` } } });
    expect(await subOf(ids.target)).toMatchObject({ planId: ids.pro, status: "active", provider: "manual", providerSubscriptionId: null });

    const switched = await users.updateAdminUser(ids.actor, ids.target, { planId: ids.team });
    expect(switched).toMatchObject({ ok: true, changes: { plan: { from: `${tag} Pro`, to: `${tag} Team` } } });
    expect(await db.select().from(s.subscriptions).where(eq(s.subscriptions.userId, ids.target))).toHaveLength(1);
  });

  it("removes a granted plan with planId null", async () => {
    await users.updateAdminUser(ids.actor, ids.target, { planId: ids.pro });
    expect(await users.updateAdminUser(ids.actor, ids.target, { planId: null })).toMatchObject({ ok: true });
    expect(await subOf(ids.target)).toBeUndefined();
  });

  it("refuses to change a plan that a payment provider bills, and leaves it untouched", async () => {
    await db.insert(s.subscriptions).values({ userId: ids.target, planId: ids.pro, status: "active", provider: "stripe", providerSubscriptionId: "sub_123" });
    for (const planId of [ids.team, null]) {
      expect(await users.updateAdminUser(ids.actor, ids.target, { planId })).toMatchObject({ ok: false, reason: "billed_by_provider" });
    }
    expect(await subOf(ids.target)).toMatchObject({ planId: ids.pro, provider: "stripe", providerSubscriptionId: "sub_123" });
  });

  it("allows replacing a cancelled provider subscription", async () => {
    await db.insert(s.subscriptions).values({ userId: ids.target, planId: ids.pro, status: "canceled", provider: "stripe", providerSubscriptionId: "sub_old" });
    expect(await users.updateAdminUser(ids.actor, ids.target, { planId: ids.team })).toMatchObject({ ok: true });
    expect(await subOf(ids.target)).toMatchObject({ planId: ids.team, provider: "manual", providerSubscriptionId: null, status: "active" });
  });

  it("reports unknown users and plans, and no-ops", async () => {
    expect(await users.updateAdminUser(ids.actor, "nobody", { planId: ids.pro })).toMatchObject({ ok: false, reason: "not_found" });
    expect(await users.updateAdminUser(ids.actor, ids.target, { planId: "00000000-0000-4000-8000-000000000000" })).toMatchObject({ ok: false, reason: "plan_not_found" });
    expect(await users.updateAdminUser(ids.actor, ids.target, { planId: null })).toMatchObject({ ok: false, reason: "nothing_to_change" });
    expect(await users.updateAdminUser(ids.actor, ids.target, { isPlatformAdmin: false })).toMatchObject({ ok: false, reason: "nothing_to_change" });
  });

  it("grants and revokes platform admin for another user", async () => {
    expect(await users.updateAdminUser(ids.actor, ids.target, { isPlatformAdmin: true })).toMatchObject({ ok: true, changes: { isPlatformAdmin: { from: false, to: true } } });
    expect(await adminFlag(ids.target)).toBe(true);
    expect(await users.updateAdminUser(ids.actor, ids.target, { isPlatformAdmin: false })).toMatchObject({ ok: true });
    expect(await adminFlag(ids.target)).toBe(false);
  });

  it("never lets an admin change their own admin access, and applies nothing from that request", async () => {
    const r = await users.updateAdminUser(ids.actor, ids.actor, { isPlatformAdmin: false, planId: ids.pro });
    expect(r).toMatchObject({ ok: false, reason: "self" });
    expect(await adminFlag(ids.actor)).toBe(true);
    expect(await subOf(ids.actor)).toBeUndefined();
  });

  it("lists users with paging, search and billing flags", async () => {
    await db.insert(s.subscriptions).values({ userId: ids.target, planId: ids.pro, status: "active", provider: "stripe", providerSubscriptionId: "sub_9" });
    await users.updateAdminUser(ids.actor, ids.other, { planId: ids.team });

    const found = await queries.listAdminUsers(tag, 1, 2);
    expect(found.total).toBe(3);
    expect(found.rows).toHaveLength(2);
    expect(found.pageSize).toBe(2);
    const page2 = await queries.listAdminUsers(tag, 2, 2);
    expect(page2.rows).toHaveLength(1);
    expect(new Set([...found.rows, ...page2.rows].map((r) => r.id)).size).toBe(3);

    const all = (await queries.listAdminUsers(tag, 1, 10)).rows;
    expect(all.find((r) => r.id === ids.target)).toMatchObject({ billedByProvider: true, subscriptionProvider: "stripe", planName: `${tag} Pro` });
    expect(all.find((r) => r.id === ids.other)).toMatchObject({ billedByProvider: false, subscriptionProvider: "manual" });
    expect(all.find((r) => r.id === ids.actor)).toMatchObject({ billedByProvider: false, planName: null, isPlatformAdmin: true });
    expect((await queries.listAdminUsers("no-such-person-zzz")).total).toBe(0);
  });
});
