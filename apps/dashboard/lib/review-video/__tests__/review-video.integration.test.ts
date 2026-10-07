import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Real Postgres (migrations applied) and, for the render test, real Remotion + Chromium.
 * Skipped unless TEST_DATABASE_URL is set:  TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard
 * Storage, plan lookup and notifications are stubbed.
 */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const uploads: { key: string; size: number }[] = [];
const deletedKeys: string[] = [];
let failDelete = false;
let monthlyCredits = 2;

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    upload: async (buf: Buffer, key: string) => {
      uploads.push({ key, size: buf.length });
      return `https://cdn.test/${key}`;
    },
    delete: async (key: string) => {
      if (failDelete) throw new Error("bucket unreachable");
      deletedKeys.push(key);
    },
  }),
}));
vi.mock("@/lib/payments/subscription", () => ({
  getSubscriptionLimits: async () => ({ reviewVideoCredits: monthlyCredits, aiVideoCredits: 0, removeWatermark: false }),
}));
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: vi.fn(), createNotification: vi.fn() }));

const LONG_TEXT = "x".repeat(450);

run("review videos (postgres)", () => {
  type Db = typeof import("@/lib/db").db;
  let db: Db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let svc: typeof import("../service");
  let render: typeof import("../render");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const ids = { user: `rv-test-${Date.now()}`, space: "", otherSpace: "", source: "", reviews: [] as string[], foreign: "" };

  const base = (over: Partial<Parameters<typeof svc.createReviewVideo>[0]> = {}) => ({
    spaceId: ids.space,
    userId: ids.user,
    template: "spotlight",
    aspect: "9:16" as const,
    reviewIds: [ids.reviews[0]],
    rightsConfirmed: true,
    ...over,
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    svc = await import("../service");
    render = await import("../render");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;

    await db.insert(s.user).values({ id: ids.user, name: "RV Test", email: `${ids.user}@example.test` });
    const [space] = await db.insert(s.spaces).values({ name: "RV", ownerId: ids.user, embedKey: ids.user }).returning();
    const [other] = await db.insert(s.spaces).values({ name: "RV other", ownerId: ids.user, embedKey: `${ids.user}-o` }).returning();
    ids.space = space.id;
    ids.otherSpace = other.id;
    const [source] = await db
      .insert(s.reviewSources)
      .values({ spaceId: space.id, provider: "google", providerBusinessId: "place-1", ratingAverage: 4.8, ratingTotal: 213 })
      .returning();
    ids.source = source.id;

    const texts = [
      "Setup took ten minutes and support answered every question the same day.  ",
      "Our conversion rate went up within a week.",
      "Simple to use and the reports are genuinely useful.",
      "Fast, friendly and exactly what we needed.",
      LONG_TEXT,
    ];
    for (const [i, text] of texts.entries()) {
      const [r] = await db
        .insert(s.reviews)
        .values({
          spaceId: space.id,
          sourceId: source.id,
          provider: "google",
          providerReviewId: `${ids.user}-r${i}`,
          authorName: `Reviewer ${i}`,
          rating: 5 - (i % 2),
          text,
          reviewDate: new Date(Date.UTC(2026, 2, 5)),
        })
        .returning();
      ids.reviews.push(r.id);
    }
    const [foreign] = await db
      .insert(s.reviews)
      .values({ spaceId: other.id, provider: "google", providerReviewId: `${ids.user}-f`, authorName: "Other", rating: 5, text: "A review in another space entirely." })
      .returning();
    ids.foreign = foreign.id;
  }, 600_000);

  beforeEach(async () => {
    monthlyCredits = 2;
    uploads.length = 0;
    await db.delete(s.reviewVideos);
    await db.delete(s.jobs);
    await db.update(s.reviewSources).set({ ratingAverage: 4.8, ratingTotal: 213 }).where(eq(s.reviewSources.id, ids.source));
  });

  afterAll(async () => {
    await db.delete(s.reviewVideos);
    await db.delete(s.jobs);
    await db.delete(s.user).where(eq(s.user.id, ids.user)); // cascades spaces, sources, reviews
    await pool?.end();
    await releaseLock?.();
  });

  it("creates a queued video with a verbatim snapshot and exactly one render job", async () => {
    const video = await svc.createReviewVideo(base());
    expect(video.status).toBe("queued");
    expect(video.rightsConfirmedAt).toBeTruthy();
    // The wording the owner agreed to is recorded, so the confirmation can be matched to it later
    expect(video.rightsWordingVersion).toBe((await import("../rights")).REVIEW_RIGHTS_VERSION);
    expect(video.reviewIds).toEqual([ids.reviews[0]]);

    const props = video.props as { reviews: { text: string; author: string; date: string; source: string }[]; brand: string };
    // Only surrounding whitespace is removed; the words are exactly what the provider returned
    expect(props.reviews[0].text).toBe("Setup took ten minutes and support answered every question the same day.");
    expect(props.reviews[0]).toMatchObject({ author: "Reviewer 0", date: "March 2026", source: "google" });
    expect(props.brand).toMatch(/^#[0-9a-f]{6}$/i);

    const jobs = await db.select().from(s.jobs);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ type: "review_video", payload: { videoId: video.id } });
    expect(video.jobId).toBe(jobs[0].id);
  });

  it("requires the owner's confirmation that they may use the reviews", async () => {
    await expect(svc.createReviewVideo(base({ rightsConfirmed: false }))).rejects.toMatchObject({ status: 400 });
    expect(await db.select().from(s.reviewVideos)).toHaveLength(0);
  });

  it("rejects bad input: unknown template, other space's review, duplicate, wrong count, too long, bad colour", async () => {
    await expect(svc.createReviewVideo(base({ template: "nope" }))).rejects.toMatchObject({ status: 400 });
    await expect(svc.createReviewVideo(base({ reviewIds: [ids.foreign] }))).rejects.toMatchObject({ status: 404 });
    await expect(svc.createReviewVideo(base({ reviewIds: [ids.reviews[0], ids.reviews[0]] }))).rejects.toMatchObject({ status: 400 });
    await expect(svc.createReviewVideo(base({ template: "stack", reviewIds: [ids.reviews[0], ids.reviews[1]] }))).rejects.toMatchObject({ status: 422 });
    await expect(svc.createReviewVideo(base({ reviewIds: [ids.reviews[4]] }))).rejects.toMatchObject({ status: 422 });
    await expect(svc.createReviewVideo(base({ brandColor: "red" }))).rejects.toMatchObject({ status: 400 });
    expect(await db.select().from(s.jobs)).toHaveLength(0);
  });

  it("keeps the order the owner picked for a stack", async () => {
    const order = [ids.reviews[3], ids.reviews[1], ids.reviews[2]];
    const video = await svc.createReviewVideo(base({ template: "stack", reviewIds: order }));
    const props = video.props as { reviews: { author: string }[] };
    expect(props.reviews.map((r) => r.author)).toEqual(["Reviewer 3", "Reviewer 1", "Reviewer 2"]);
    expect(video.reviewIds).toEqual(order);
  });

  it("rating spotlight uses the provider's totals, and refuses without them", async () => {
    const ok = await svc.createReviewVideo(base({ template: "rating-spotlight", reviewIds: [ids.reviews[1]] }));
    expect((ok.props as { aggregate: unknown }).aggregate).toEqual({ source: "google", rating: 4.8, total: 213 });

    await db.update(s.reviewSources).set({ ratingAverage: null, ratingTotal: null }).where(eq(s.reviewSources.id, ids.source));
    await expect(svc.createReviewVideo(base({ template: "rating-spotlight", reviewIds: [ids.reviews[1]] }))).rejects.toMatchObject({ status: 422 });
  });

  describe("reviews the owner typed in", () => {
    let ownId = "";
    beforeAll(async () => {
      const id = crypto.randomUUID();
      await db.insert(s.reviews).values({
        id,
        spaceId: ids.space,
        provider: "own",
        providerReviewId: `own:${id}`,
        authorName: "Priya N.",
        rating: null,
        text: "They fixed our books in a week and never once made us feel silly for asking.",
        linkUrl: "https://www.priyas-bakery.example/testimonials/42",
        reviewDate: null,
      });
      ownId = id;
    });

    it("makes a video with no rating, no date and no provider, shows only the site, and records the own wording", async () => {
      const video = await svc.createReviewVideo(base({ reviewIds: [ownId], template: "dark-card" }));
      expect(video.rightsWordingVersion).toBe((await import("../rights")).REVIEW_RIGHTS_OWN_VERSION);
      const props = video.props as { reviews: Record<string, unknown>[]; aggregate?: unknown };
      expect(props.reviews[0]).toEqual({
        author: "Priya N.",
        rating: null,
        text: "They fixed our books in a week and never once made us feel silly for asking.",
        source: "own",
        link: "priyas-bakery.example",
      });
      expect(props.aggregate).toBeUndefined();
    });

    it("cannot use rating spotlight (there are no provider totals to show)", async () => {
      await expect(svc.createReviewVideo(base({ reviewIds: [ownId], template: "rating-spotlight" }))).rejects.toMatchObject({ status: 422 });
    });

    it("is listed with no rating and its site", async () => {
      const { reviews } = await svc.listReviewOptions(ids.space);
      expect(reviews.find((r) => r.id === ownId)).toMatchObject({ rating: null, source: "own", link: "priyas-bakery.example", date: null });
    });

    it("renders a real MP4 without stars or a logo", async () => {
      const video = await svc.createReviewVideo(base({ reviewIds: [ownId], template: "minimal", aspect: "16:9" }));
      await render.renderQueuedReviewVideo(video.id);
      const [done] = await db.select().from(s.reviewVideos).where(eq(s.reviewVideos.id, video.id));
      expect(done.status).toBe("done");
    }, 240_000);
  });

  it("lists reviews with the templates each one fits, and the provider stats", async () => {
    const { reviews, stats } = await svc.listReviewOptions(ids.space);
    const long = reviews.find((r) => r.text === LONG_TEXT)!;
    expect(long.fits).toEqual([]); // 450 chars fits nothing: reviews are never shortened
    const short = reviews.find((r) => r.author === "Reviewer 1")!;
    expect(short.fits).toEqual(expect.arrayContaining(["spotlight", "stack", "rating-spotlight"]));
    expect(stats).toEqual([{ source: "google", rating: 4.8, total: 213 }]);
  });

  it("never overspends credits, even with concurrent requests", async () => {
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => svc.createReviewVideo(base())));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason.code === "PLAN_LIMIT")).toBe(true);
    expect(await db.select().from(s.jobs)).toHaveLength(2);
  });

  it("a plan without review videos is refused, and a failed render frees its credit", async () => {
    monthlyCredits = 0;
    await expect(svc.createReviewVideo(base())).rejects.toMatchObject({ code: "PLAN_LIMIT" });

    monthlyCredits = 1;
    const first = await svc.createReviewVideo(base());
    await expect(svc.createReviewVideo(base())).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    await db.update(s.reviewVideos).set({ status: "failed" }).where(eq(s.reviewVideos.id, first.id));
    await expect(svc.createReviewVideo(base())).resolves.toMatchObject({ status: "queued" });
  });

  it("deleting a finished video keeps its credit used and deletes its file; drafts of failures are removed", async () => {
    monthlyCredits = 1;
    deletedKeys.length = 0;
    const done = await svc.createReviewVideo(base());
    const key = `review-videos/${ids.space}/${done.id}-abc.mp4`;
    await db.update(s.reviewVideos).set({ status: "done", outputUrl: `https://cdn.test/${key}` }).where(eq(s.reviewVideos.id, done.id));
    expect(await svc.removeReviewVideo(done.id, ids.space)).toBe("archived");
    expect(deletedKeys).toEqual([key]); // the public file is gone, not just the link in the database
    expect((await svc.getReviewVideoCredits(ids.user)).used).toBe(1);
    await expect(svc.createReviewVideo(base())).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    expect(await svc.listReviewVideos(ids.space)).toHaveLength(0);

    const failed = await db.insert(s.reviewVideos).values({ spaceId: ids.space, template: "spotlight", status: "failed", props: {}, rightsConfirmedAt: new Date() }).returning();
    expect(await svc.removeReviewVideo(failed[0].id, ids.space)).toBe("removed");
    expect(deletedKeys).toHaveLength(1); // a failed video has no file
    const queued = await db.insert(s.reviewVideos).values({ spaceId: ids.space, template: "spotlight", status: "queued", props: {}, rightsConfirmedAt: new Date() }).returning();
    await expect(svc.removeReviewVideo(queued[0].id, ids.space)).rejects.toMatchObject({ status: 400 });
  });

  it("leaves a finished video as it was when its file cannot be deleted, and succeeds on retry", async () => {
    monthlyCredits = 5;
    deletedKeys.length = 0;
    const done = await svc.createReviewVideo(base());
    const url = `https://cdn.test/review-videos/${ids.space}/${done.id}-abc.mp4`;
    await db.update(s.reviewVideos).set({ status: "done", outputUrl: url }).where(eq(s.reviewVideos.id, done.id));

    failDelete = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(svc.removeReviewVideo(done.id, ids.space)).rejects.toMatchObject({ status: 502 });
    err.mockRestore();
    failDelete = false;
    const [untouched] = await db.select().from(s.reviewVideos).where(eq(s.reviewVideos.id, done.id));
    expect(untouched.deletedAt).toBeNull();
    expect(untouched.outputUrl).toBe(url);

    expect(await svc.removeReviewVideo(done.id, ids.space)).toBe("archived");
    expect(deletedKeys).toHaveLength(1);
  });

  it("renders a real MP4 with Remotion, uploads it, and marks the video done", async () => {
    const video = await svc.createReviewVideo(base({ template: "minimal", aspect: "16:9" }));
    await render.renderQueuedReviewVideo(video.id);

    const [done] = await db.select().from(s.reviewVideos).where(eq(s.reviewVideos.id, video.id));
    expect(done.status).toBe("done");
    expect(done.outputUrl).toMatch(/^https:\/\/cdn\.test\/review-videos\//);
    expect(done.durationSeconds).toBeGreaterThan(5);
    expect(done.renderMs).toBeGreaterThan(0);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].size).toBeGreaterThan(50_000);
  }, 240_000);

  it("settles content that can never render as failed instead of retrying", async () => {
    const [bad] = await db
      .insert(s.reviewVideos)
      .values({ spaceId: ids.space, template: "spotlight", status: "queued", props: { reviews: [], brand: "#cf3d0b" }, rightsConfirmedAt: new Date() })
      .returning();
    await render.renderQueuedReviewVideo(bad.id);
    const [row] = await db.select().from(s.reviewVideos).where(eq(s.reviewVideos.id, bad.id));
    expect(row.status).toBe("failed");
    expect(row.error).toMatch(/needs 1 review/);
    expect(uploads).toHaveLength(0);
  }, 120_000);
});
