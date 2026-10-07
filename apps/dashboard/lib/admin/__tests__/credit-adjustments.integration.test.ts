import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("admin credit adjustments (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let adj: typeof import("../credit-adjustments");
  let review: typeof import("@/lib/review-video/service");
  let ai: typeof import("@/lib/ai-video/credits");
  let usage: typeof import("../usage");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `adj${Date.now()}`;
  const admin = `${tag}-admin`;
  const owner = `${tag}-owner`;
  let planId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    adj = await import("../credit-adjustments");
    review = await import("@/lib/review-video/service");
    ai = await import("@/lib/ai-video/credits");
    usage = await import("../usage");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    const { PLAN_LIMIT_PRESETS, serializeLimits } = await import("@/lib/payments/plan-limits");
    await db.insert(s.user).values([
      { id: admin, name: "Admin", email: `${admin}@example.test`, isPlatformAdmin: true },
      { id: owner, name: "Owner", email: `${owner}@example.test` },
    ]);
    const [plan] = await db
      .insert(s.plans)
      .values({ name: `${tag} Plan`, price: 1900, interval: "month", limits: serializeLimits({ ...PLAN_LIMIT_PRESETS.pro, reviewVideoCredits: 3, aiVideoCredits: 2 }) })
      .returning();
    planId = plan.id;
    await db.insert(s.subscriptions).values({ userId: owner, planId, status: "active", provider: "manual" });
  }, 600_000);

  afterAll(async () => {
    await db.delete(s.user).where(eq(s.user.id, owner));
    await db.delete(s.user).where(eq(s.user.id, admin));
    await db.delete(s.plans).where(eq(s.plans.id, planId));
    await pool?.end();
    await releaseLock?.();
  });

  it("changes nothing until an adjustment is recorded", async () => {
    expect((await review.getReviewVideoCredits(owner)).limit).toBe(3);
    expect((await ai.getAiVideoCredits(owner)).limit).toBe(2);
  });

  it("adds credits for this month, per kind, and the creation checks see them", async () => {
    expect(await adj.addAdjustment(admin, owner, { kind: "review", amount: 5, reason: "Goodwill after an outage" })).toMatchObject({ ok: true });
    expect(await adj.addAdjustment(admin, owner, { kind: "review", amount: -2, reason: "Correction" })).toMatchObject({ ok: true });
    expect((await review.getReviewVideoCredits(owner)).limit).toBe(6); // 3 + 5 - 2
    expect((await review.getReviewVideoCredits(owner)).remaining).toBe(6);
    expect((await ai.getAiVideoCredits(owner)).limit).toBe(2); // the other kind is untouched
  });

  it("applies to its own month only", async () => {
    const nextMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 15));
    expect((await review.getReviewVideoCredits(owner, db, nextMonth)).limit).toBe(3);
  });

  it("never goes below zero, and leaves an unlimited plan unlimited", () => {
    expect(adj.applyAdjustment(3, -10)).toBe(0);
    expect(adj.applyAdjustment(Infinity, -10)).toBe(Infinity);
    expect(adj.applyAdjustment(3, 4)).toBe(7);
  });

  it("is shown in the usage report's limits", async () => {
    // The report lists accounts that used credit this month, so give the owner one video
    const [space] = await db.insert(s.spaces).values({ name: `${tag} space`, ownerId: owner, embedKey: `${tag}-space` }).returning();
    await db.insert(s.reviewVideos).values({ spaceId: space.id, template: "spotlight", status: "done", props: {}, rightsConfirmedAt: new Date() });
    const report = await usage.getUsageReport(adj.monthKey(), 1, 100);
    const row = report.accounts.find((a) => a.ownerId === owner);
    expect(row).toMatchObject({ reviewCredits: 1, reviewLimit: 6, aiLimit: 2 });
    await db.delete(s.spaces).where(eq(s.spaces.id, space.id));
  });

  it("lists this month's adjustments with who made them", async () => {
    const rows = await adj.listAdjustments(owner);
    expect(rows.map((r) => [r.kind, r.amount, r.reason, r.actorEmail])).toEqual([
      ["review", -2, "Correction", `${admin}@example.test`],
      ["review", 5, "Goodwill after an outage", `${admin}@example.test`],
    ]);
  });

  it("refuses zero, fractions, huge amounts, a missing reason and unknown users", async () => {
    for (const amount of [0, 1.5, 1001, -1001, Number.NaN]) {
      expect(await adj.addAdjustment(admin, owner, { kind: "ai", amount, reason: "x" })).toMatchObject({ ok: false, reason: "invalid" });
    }
    expect(await adj.addAdjustment(admin, owner, { kind: "ai", amount: 1, reason: "  " })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await adj.addAdjustment(admin, "nobody-here", { kind: "ai", amount: 1, reason: "x" })).toMatchObject({ ok: false, reason: "not_found" });
    expect((await ai.getAiVideoCredits(owner)).limit).toBe(2);
  });
});
