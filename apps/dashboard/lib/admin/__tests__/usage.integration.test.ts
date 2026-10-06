import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

// A month nothing else writes to, so the totals are exactly this test's rows
const MONTH = "2031-03";
const at = (iso: string) => new Date(iso);

run("admin usage report (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let usage: typeof import("../usage");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `usage${Date.now()}`;
  const owners = { a: `${tag}-a`, b: `${tag}-b`, c: `${tag}-c` };
  const spaceIds: string[] = [];
  const testimonialIds: string[] = [];
  let planId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    usage = await import("../usage");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    const { PLAN_LIMIT_PRESETS, serializeLimits } = await import("@/lib/payments/plan-limits");

    await db.insert(s.user).values(Object.values(owners).map((id) => ({ id, name: `Owner ${id.slice(-1)}`, email: `${id}@example.test` })));
    const [plan] = await db
      .insert(s.plans)
      .values({ name: `${tag} Plan`, price: 1900, interval: "month", limits: serializeLimits({ ...PLAN_LIMIT_PRESETS.pro, reviewVideoCredits: 3, aiVideoCredits: 2 }) })
      .returning();
    planId = plan.id;
    // Owner A is on that plan, B and C have no subscription (free tier), C has a second space
    await db.insert(s.subscriptions).values({ userId: owners.a, planId, status: "active", provider: "manual" });

    const mk = async (owner: string, n: number) => {
      const [sp] = await db.insert(s.spaces).values({ name: `${tag} ${n}`, ownerId: owner, embedKey: `${tag}-${n}` }).returning();
      spaceIds.push(sp.id);
      const [t] = await db.insert(s.testimonials).values({ spaceId: sp.id, platform: "text", quote: "Great product, it saved us hours every week." }).returning();
      testimonialIds.push(t.id);
      const [c] = await db.insert(s.testimonialConsents).values({ testimonialId: t.id, spaceId: sp.id, source: "collect_form", textVersion: "v1", grantedAt: new Date() }).returning();
      return { space: sp.id, testimonial: t.id, consent: c.id };
    };
    const A = await mk(owners.a, 1);
    const B = await mk(owners.b, 2);
    const C1 = await mk(owners.c, 3);
    const C2 = await mk(owners.c, 4);

    const rv = (space: string, status: "queued" | "rendering" | "done" | "failed", createdAt: Date, extra: Record<string, unknown> = {}) =>
      ({ spaceId: space, template: "spotlight", status, props: {}, rightsConfirmedAt: new Date(), createdAt, ...extra });
    await db.insert(s.reviewVideos).values([
      // Owner A: 3 holding credits (one deleted by the owner, which still counts) and 1 failed
      rv(A.space, "done", at("2031-03-05T10:00:00Z"), { renderMs: 1000 }),
      rv(A.space, "done", at("2031-03-06T10:00:00Z"), { renderMs: 3000, deletedAt: at("2031-03-07T10:00:00Z") }),
      rv(A.space, "queued", at("2031-03-20T10:00:00Z")),
      rv(A.space, "failed", at("2031-03-21T10:00:00Z"), { error: "boom" }),
      // Month edges: the last second of February and the first of April are outside March
      rv(A.space, "done", at("2031-02-28T23:59:59Z")),
      rv(A.space, "done", at("2031-04-01T00:00:00Z")),
      // Owner C: only a failure in one space, one credit in the other
      rv(C1.space, "failed", at("2031-03-10T10:00:00Z"), { error: "x" }),
      rv(C2.space, "rendering", at("2031-03-11T10:00:00Z")),
    ]);

    const gv = (x: { space: string; testimonial: string; consent: string }, status: "draft" | "queued" | "rendering" | "done" | "failed", approved: Date | null, cost: number | null) =>
      ({ spaceId: x.space, testimonialId: x.testimonial, consentId: x.consent, status, template: "t", voice: "v", scriptOriginal: "original text here", trimApprovedAt: approved, costCents: cost });
    await db.insert(s.generatedVideos).values([
      gv(A, "done", at("2031-03-08T10:00:00Z"), 120),
      gv(A, "failed", at("2031-03-09T10:00:00Z"), 40), // refunded credit, but the provider cost was real
      gv(A, "done", at("2031-02-28T23:59:59Z"), 999), // February
      gv(A, "draft", null, null), // never approved: not in any month
      gv(B, "done", at("2031-03-12T10:00:00Z"), 200), // free tier allows 0 AI videos: over limit
    ]);
  }, 600_000);

  afterAll(async () => {
    await db.delete(s.generatedVideos).where(inArray(s.generatedVideos.spaceId, spaceIds));
    await db.delete(s.reviewVideos).where(inArray(s.reviewVideos.spaceId, spaceIds));
    await db.delete(s.testimonialConsents).where(inArray(s.testimonialConsents.spaceId, spaceIds));
    await db.delete(s.testimonials).where(inArray(s.testimonials.id, testimonialIds));
    await db.delete(s.spaces).where(inArray(s.spaces.id, spaceIds));
    await db.delete(s.subscriptions).where(eq(s.subscriptions.planId, planId));
    await db.delete(s.plans).where(eq(s.plans.id, planId));
    await db.delete(s.user).where(inArray(s.user.id, Object.values(owners)));
    await pool?.end();
    await releaseLock?.();
  });

  it("totals the month: holding credits only, month edges excluded, failures and cost counted", async () => {
    const r = await usage.getUsageReport(MONTH);
    expect(r.month).toBe(MONTH);
    expect(r.totals).toEqual({
      reviewCredits: 4, // A: done, done (deleted), queued; C: rendering
      aiCredits: 2, // A: done; B: done
      aiCostCents: 360, // 120 + 40 (failed) + 200
      failed: 3, // A review, C review, A AI
      videos: 9, // 6 review videos (4 for A, 2 for C) + 3 AI videos approved in March (2 for A, 1 for B)
      accounts: 3,
      avgReviewRenderMs: 2000,
    });
  });

  it("lists accounts heaviest first with their plan and allowance", async () => {
    const r = await usage.getUsageReport(MONTH);
    const byOwner = Object.fromEntries(r.accounts.map((a) => [a.ownerId, a]));
    expect(r.accounts.map((a) => a.ownerId)).toEqual([owners.a, owners.b, owners.c].sort((x, y) => {
      const credits = (o: string) => byOwner[o].reviewCredits + byOwner[o].aiCredits;
      return credits(y) - credits(x) || byOwner[y].aiCostCents - byOwner[x].aiCostCents || byOwner[x].email.localeCompare(byOwner[y].email);
    }));
    expect(byOwner[owners.a]).toMatchObject({ planName: `${tag} Plan`, reviewCredits: 3, reviewLimit: 3, aiCredits: 1, aiLimit: 2, aiCostCents: 160, failed: 2 });
    expect(usage.limitState(byOwner[owners.a].reviewCredits, byOwner[owners.a].reviewLimit)).toBe("at");
    // Free tier (no subscription): the free allowance applies, and an AI video is over a limit of zero
    expect(byOwner[owners.b]).toMatchObject({ planName: null, aiCredits: 1, aiLimit: 0, aiCostCents: 200 });
    expect(usage.limitState(byOwner[owners.b].aiCredits, byOwner[owners.b].aiLimit)).toBe("over");
    // C had a failure in one space and a credit in another: both roll up to the owner
    expect(byOwner[owners.c]).toMatchObject({ reviewCredits: 1, failed: 1, aiCredits: 0 });
  });

  it("pages the account list and reports the total", async () => {
    const p1 = await usage.getUsageReport(MONTH, 1, 2);
    const p2 = await usage.getUsageReport(MONTH, 2, 2);
    expect(p1.totalAccounts).toBe(3);
    expect([p1.accounts.length, p2.accounts.length]).toEqual([2, 1]);
    expect(new Set([...p1.accounts, ...p2.accounts].map((a) => a.ownerId)).size).toBe(3);
    // Past the end shows the last page
    const past = await usage.getUsageReport(MONTH, 3, 2);
    expect(past.page).toBe(2);
    expect(past.accounts.map((a) => a.ownerId)).toEqual(p2.accounts.map((a) => a.ownerId));
    expect((await usage.getUsageReport(MONTH, -4, 2)).page).toBe(1);
  });

  it("reports an empty month as zeros, and shows February separately", async () => {
    const empty = await usage.getUsageReport("2031-05");
    expect(empty.totals).toMatchObject({ reviewCredits: 0, aiCredits: 0, aiCostCents: 0, failed: 0, videos: 0, accounts: 0, avgReviewRenderMs: null });
    expect(empty.accounts).toEqual([]);
    const feb = await usage.getUsageReport("2031-02");
    expect(feb.totals).toMatchObject({ reviewCredits: 1, aiCredits: 1, aiCostCents: 999 });
  });
});
