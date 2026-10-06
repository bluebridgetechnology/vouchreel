import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const storage = vi.hoisted(() => ({ deleted: [] as string[], fail: false }));
const notified = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    delete: async (key: string) => {
      if (storage.fail) throw new Error("bucket unreachable");
      storage.deleted.push(key);
    },
  }),
}));
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: (...a: unknown[]) => notified(...a), createNotification: vi.fn() }));

run("withdrawing AI video consent (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let w: typeof import("../consent-withdrawal");
  let generate: typeof import("../generate");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `cw${Date.now()}`;
  const owner = `${tag}-owner`;
  let spaceId = "";
  const testimonialIds: string[] = [];

  /** A testimonial with its own consent. */
  async function seed(name: string) {
    const [t] = await db.insert(s.testimonials).values({ spaceId, platform: "text", quote: "Great product.", customerName: name }).returning();
    testimonialIds.push(t.id);
    const [c] = await db.insert(s.testimonialConsents).values({ testimonialId: t.id, spaceId, source: "collect_form", textVersion: "v1", grantedAt: new Date() }).returning();
    const video = async (status: "draft" | "queued" | "rendering" | "done" | "failed", outputUrl: string | null = null) =>
      (await db.insert(s.generatedVideos).values({ spaceId, testimonialId: t.id, consentId: c.id, status, template: "b", voice: "v", scriptOriginal: "some words here", outputUrl }).returning())[0];
    return { t, c, video };
  }
  const row = async (id: string) => (await db.select().from(s.generatedVideos).where(eq(s.generatedVideos.id, id)))[0];
  const consentRow = async (id: string) => (await db.select().from(s.testimonialConsents).where(eq(s.testimonialConsents.id, id)))[0];
  const cleanupKeys = async () => (await db.select().from(s.jobs).where(eq(s.jobs.type, "file_cleanup"))).flatMap((j) => j.payload.keys as string[]).sort();

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.BETTER_AUTH_SECRET = "a-test-secret-of-sufficient-length-0123456789";
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    w = await import("../consent-withdrawal");
    generate = await import("../generate");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values({ id: owner, name: "O", email: `${owner}@example.test` });
    const [space] = await db.insert(s.spaces).values({ name: tag, ownerId: owner, embedKey: tag }).returning();
    spaceId = space.id;
  }, 600_000);

  beforeEach(async () => {
    storage.deleted.length = 0;
    storage.fail = false;
    notified.mockClear();
    await db.delete(s.jobs);
  });

  afterAll(async () => {
    await db.delete(s.jobs);
    await db.delete(s.generatedVideos).where(inArray(s.generatedVideos.testimonialId, testimonialIds));
    await db.delete(s.spaces).where(eq(s.spaces.id, spaceId));
    await db.delete(s.user).where(eq(s.user.id, owner));
    await pool?.end();
    await releaseLock?.();
  });

  it("records the withdrawal, removes finished videos' files, stops unfinished ones, and tells the owner", async () => {
    const { c, video, t } = await seed("Ada");
    const done = await video("done", "https://cdn.test/ai-videos/sp/t/done.mp4");
    const queued = await video("queued");
    const draft = await video("draft");
    const failed = await video("failed");

    const result = await w.withdrawConsent(c.id, "customer");
    expect(result).toEqual({ status: "withdrawn", removedVideos: 1, stoppedVideos: 2 });

    expect((await consentRow(c.id)).revokedAt).not.toBeNull();
    expect(await row(done.id)).toMatchObject({ outputUrl: null, status: "done", moderatedBy: null, moderationReason: w.WITHDRAWN_REASON });
    expect((await row(done.id)).moderatedAt).not.toBeNull();
    for (const v of [queued, draft]) expect(await row(v.id)).toMatchObject({ status: "failed", error: w.WITHDRAWN_REASON });
    expect(await row(failed.id)).toMatchObject({ status: "failed", error: null }); // untouched

    expect(storage.deleted).toEqual(["ai-videos/sp/t/done.mp4"]); // gone immediately, not left for a worker
    expect(await cleanupKeys()).toEqual(["ai-videos/sp/t/done.mp4"]); // and queued as a safety net
    expect(notified).toHaveBeenCalledWith(spaceId, expect.objectContaining({ type: "consent.withdrawn", body: expect.stringContaining("1 video was removed") }));
    // No new video can be made from this testimonial any more
    expect(await generate.findActiveConsent(t.id)).toBeNull();
  });

  it("a second withdrawal changes nothing and does not notify again", async () => {
    const { c, video } = await seed("Bo");
    await video("done", "https://cdn.test/ai-videos/sp/t/bo.mp4");
    await w.withdrawConsent(c.id, "customer");
    notified.mockClear();
    storage.deleted.length = 0;
    expect(await w.withdrawConsent(c.id, "owner")).toEqual({ status: "already_withdrawn", removedVideos: 0, stoppedVideos: 0 });
    expect(storage.deleted).toEqual([]);
    expect(notified).not.toHaveBeenCalled();
  });

  it("an unknown consent is reported, not invented", async () => {
    expect(await w.withdrawConsent("00000000-0000-4000-8000-000000000000", "customer")).toEqual({ status: "not_found", removedVideos: 0, stoppedVideos: 0 });
    expect(notified).not.toHaveBeenCalled();
  });

  it("still withdraws when storage is down: the file is left to the queued cleanup job", async () => {
    const { c, video } = await seed("Cy");
    const done = await video("done", "https://cdn.test/ai-videos/sp/t/cy.mp4");
    storage.fail = true;
    expect(await w.withdrawConsent(c.id, "customer")).toMatchObject({ status: "withdrawn", removedVideos: 1 });
    expect((await consentRow(c.id)).revokedAt).not.toBeNull();
    expect((await row(done.id)).outputUrl).toBeNull(); // the link is dead for the owner even though the file is not deleted yet
    expect(storage.deleted).toEqual([]);
    expect(await cleanupKeys()).toEqual(["ai-videos/sp/t/cy.mp4"]); // a worker will finish it
  });

  it("only touches videos made under this consent", async () => {
    const a = await seed("Di");
    const b = await seed("Ed");
    const aDone = await a.video("done", "https://cdn.test/ai-videos/sp/t/a.mp4");
    const bDone = await b.video("done", "https://cdn.test/ai-videos/sp/t/b.mp4");
    await w.withdrawConsent(a.c.id, "customer");
    expect((await row(aDone.id)).outputUrl).toBeNull();
    expect((await row(bDone.id)).outputUrl).toBe("https://cdn.test/ai-videos/sp/t/b.mp4");
    expect((await consentRow(b.c.id)).revokedAt).toBeNull();
    expect(await generate.findActiveConsent(b.t.id)).not.toBeNull();
  });

  it("does not delete a video an admin already took down, and describes the consent for the public page", async () => {
    const { c, video } = await seed("Fay");
    await db.update(s.generatedVideos).set({ moderatedAt: new Date() }).where(eq(s.generatedVideos.id, (await video("done", null)).id));
    expect(await w.withdrawConsent(c.id, "customer")).toMatchObject({ removedVideos: 0 });

    const other = await seed("Gus");
    expect(await w.describeConsent(other.c.id)).toMatchObject({ customerName: "Gus", spaceName: tag, revokedAt: null });
    expect(await w.describeConsent("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
