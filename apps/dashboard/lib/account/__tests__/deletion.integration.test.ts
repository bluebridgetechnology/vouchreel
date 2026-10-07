import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const provider = vi.hoisted(() => ({ cancelled: [] as string[], fail: false }));
vi.mock("@/lib/payments", () => ({
  createPaymentProvider: () => ({
    cancelSubscription: async (id: string) => {
      if (provider.fail) throw new Error("provider is down");
      provider.cancelled.push(id);
    },
  }),
}));
vi.mock("@/lib/email/transport", () => ({ sendEmail: vi.fn(async () => ({ sent: false, provider: "log" })) }));

run("deleting an account (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let del: typeof import("../deletion");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `del${Date.now()}`;
  const ids = { owner: `${tag}-owner`, other: `${tag}-other`, admin: `${tag}-admin`, member: `${tag}-member`, plan: "" };
  let spaceId = "";

  const exists = async (id: string) => (await db.select({ id: s.user.id }).from(s.user).where(eq(s.user.id, id))).length === 1;
  const cleanupKeys = async () => (await db.select().from(s.jobs).where(eq(s.jobs.type, "file_cleanup"))).flatMap((j) => j.payload.keys as string[]).sort();

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.BETTER_AUTH_SECRET = "a-test-secret-of-sufficient-length-0123456789";
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    del = await import("../deletion");
    await db.insert(s.user).values([
      { id: ids.owner, name: "Owner", email: `${ids.owner}@example.test` },
      { id: ids.other, name: "Other", email: `${ids.other}@example.test` },
      { id: ids.admin, name: "Admin", email: `${ids.admin}@example.test`, isPlatformAdmin: true },
      { id: ids.member, name: "Member", email: `${ids.member}@example.test` },
    ]);
    const [plan] = await db.insert(s.plans).values({ name: `${tag} plan`, price: 1900, interval: "month" }).returning();
    ids.plan = plan.id;
  }, 120_000);

  beforeEach(async () => {
    provider.cancelled.length = 0;
    provider.fail = false;
    await db.delete(s.jobs);
  });

  afterAll(async () => {
    await db.delete(s.jobs);
    await db.delete(s.user).where(eq(s.user.id, ids.owner));
    await db.delete(s.user).where(eq(s.user.id, ids.other));
    await db.delete(s.user).where(eq(s.user.id, ids.admin));
    await db.delete(s.user).where(eq(s.user.id, ids.member));
    await db.delete(s.plans).where(eq(s.plans.id, ids.plan));
    await releaseLock?.();
  });

  it("a link token works for its account for an hour, and not for anyone else, later, or forged", () => {
    const now = Date.now();
    const token = del.deletionToken(ids.owner, now);
    expect(del.userIdFromDeletionToken(token, now + 59 * 60_000)).toBe(ids.owner);
    expect(del.userIdFromDeletionToken(token, now + 61 * 60_000)).toBeNull();
    const [, expires, sig] = token.split(".");
    expect(del.userIdFromDeletionToken(`${ids.other}.${expires}.${sig}`, now)).toBeNull();
    expect(del.userIdFromDeletionToken(`${ids.owner}.${Number(expires) + 600_000}.${sig}`, now)).toBeNull();
    expect(del.userIdFromDeletionToken("nonsense", now)).toBeNull();
  });

  it("refuses while the account has team members, and for the only platform admin", async () => {
    await db.insert(s.teamMembers).values({ teamOwnerId: ids.owner, userId: ids.member, acceptedAt: new Date() });
    expect((await del.deletionBlockers(ids.owner)).map((b) => b.code)).toEqual(["team_members"]);
    expect(await del.deleteAccount(ids.owner)).toMatchObject({ ok: false, reason: "blocked" });
    expect(await exists(ids.owner)).toBe(true);
    await db.delete(s.teamMembers).where(eq(s.teamMembers.teamOwnerId, ids.owner));

    const blockers = (await del.deletionBlockers(ids.admin)).map((b) => b.code);
    // Only meaningful when no other admin exists in this database; otherwise the admin may leave
    const others = (await db.select({ id: s.user.id }).from(s.user).where(eq(s.user.isPlatformAdmin, true))).filter((u) => u.id !== ids.admin).length;
    expect(blockers).toEqual(others === 0 ? ["last_admin"] : []);
  });

  it("cancels the subscription, queues every file the account owns, and removes the account and its data", async () => {
    const [space] = await db.insert(s.spaces).values({ name: tag, ownerId: ids.owner, embedKey: tag }).returning();
    spaceId = space.id;
    const [t] = await db.insert(s.testimonials).values({ spaceId, platform: "mp4", quote: "Great.", customerName: "Ada", videoUrl: "https://cdn.test/submissions/a.mp4" }).returning();
    const [c] = await db.insert(s.testimonialConsents).values({ testimonialId: t.id, spaceId, source: "collect_form", textVersion: "v1", grantedAt: new Date() }).returning();
    await db.insert(s.generatedVideos).values({ spaceId, testimonialId: t.id, consentId: c.id, status: "done", template: "b", voice: "v", scriptOriginal: "some words here", outputUrl: "https://cdn.test/ai-videos/a.mp4" });
    await db.insert(s.reviewVideos).values({ spaceId, createdBy: ids.owner, template: "minimal", aspect: "16:9", status: "done", props: {}, reviewIds: [], rightsConfirmedAt: new Date(), outputUrl: "https://cdn.test/review-videos/a.mp4" });
    await db.insert(s.subscriptions).values({ userId: ids.owner, planId: ids.plan, status: "active", provider: "stripe", providerSubscriptionId: "sub_123" });

    expect(await del.deleteAccount(ids.owner)).toMatchObject({ ok: true, cancelledSubscription: true });

    expect(provider.cancelled).toEqual(["sub_123"]);
    expect(await exists(ids.owner)).toBe(false);
    expect(await db.select().from(s.spaces).where(eq(s.spaces.id, spaceId))).toHaveLength(0);
    expect(await db.select().from(s.testimonials).where(eq(s.testimonials.id, t.id))).toHaveLength(0);
    expect(await db.select().from(s.subscriptions).where(eq(s.subscriptions.userId, ids.owner))).toHaveLength(0);
    expect(await cleanupKeys()).toEqual(expect.arrayContaining(["ai-videos/a.mp4", "review-videos/a.mp4", "submissions/a.mp4"]));
  });

  it("deletes nothing when the payment provider refuses to cancel", async () => {
    await db.insert(s.subscriptions).values({ userId: ids.other, planId: ids.plan, status: "active", provider: "dodo", providerSubscriptionId: "sub_999" });
    provider.fail = true;
    await expect(del.deleteAccount(ids.other)).rejects.toThrow("provider is down");
    expect(await exists(ids.other)).toBe(true);
    expect(await db.select().from(s.subscriptions).where(eq(s.subscriptions.userId, ids.other))).toHaveLength(1);
    provider.fail = false;
    expect(await del.deleteAccount(ids.other)).toMatchObject({ ok: true });
    expect(await exists(ids.other)).toBe(false);
  });

  it("does not try to cancel a subscription an admin granted", async () => {
    const id = `${tag}-manual`;
    await db.insert(s.user).values({ id, name: "M", email: `${id}@example.test` });
    await db.insert(s.subscriptions).values({ userId: id, planId: ids.plan, status: "active", provider: "manual" });
    expect(await del.deleteAccount(id)).toMatchObject({ ok: true, cancelledSubscription: false });
    expect(provider.cancelled).toEqual([]);
  });
});
