import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

vi.mock("@/lib/storage", () => ({ getStorage: () => ({ delete: async () => undefined }) }));
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: vi.fn(), createNotification: vi.fn() }));

run("made videos in the widget (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let wv: typeof import("../widget-videos");
  let withdrawal: typeof import("@/lib/ai-video/consent-withdrawal");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `wv${Date.now()}`;
  const owner = `${tag}-owner`;
  let spaceId = "";
  let otherSpaceId = "";

  const props = (author: string, text: string) => ({ reviews: [{ author, rating: 5, text, source: "google" }], brand: "#cf3d0b" });
  async function reviewVideo(over: Partial<typeof import("@/lib/db/schema").reviewVideos.$inferInsert> = {}) {
    const [v] = await db
      .insert(s.reviewVideos)
      .values({ spaceId, template: "spotlight", status: "done", props: props("Alice M.", "Great experience!"), rightsConfirmedAt: new Date(), outputUrl: `https://cdn.test/review-videos/${tag}/${crypto.randomUUID()}.mp4`, durationSeconds: 12, ...over })
      .returning();
    return v;
  }
  async function aiVideo(over: { video?: Partial<typeof import("@/lib/db/schema").generatedVideos.$inferInsert>; testimonialActive?: boolean } = {}) {
    const [t] = await db.insert(s.testimonials).values({ spaceId, platform: "text", quote: "It saved us a week.", customerName: "Ben K.", customerCompany: "Kiln Ltd", isActive: over.testimonialActive ?? true }).returning();
    const [c] = await db.insert(s.testimonialConsents).values({ testimonialId: t.id, spaceId, source: "collect_form", textVersion: "v1", grantedAt: new Date() }).returning();
    const [v] = await db
      .insert(s.generatedVideos)
      .values({ spaceId, testimonialId: t.id, consentId: c.id, status: "done", template: "b", voice: "v", scriptOriginal: "some words here", outputUrl: `https://cdn.test/ai-videos/${tag}/${crypto.randomUUID()}.mp4`, durationSeconds: 9, ...over.video })
      .returning();
    return { t, c, v };
  }
  const ids = async (space = spaceId) => (await wv.listWidgetVideos(space)).map((i) => i.id);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.BETTER_AUTH_SECRET = "a-test-secret-of-sufficient-length-0123456789";
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    wv = await import("../widget-videos");
    withdrawal = await import("@/lib/ai-video/consent-withdrawal");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values({ id: owner, name: "O", email: `${owner}@example.test` });
    const [space] = await db.insert(s.spaces).values({ name: tag, ownerId: owner, embedKey: tag }).returning();
    const [other] = await db.insert(s.spaces).values({ name: `${tag}-o`, ownerId: owner, embedKey: `${tag}-o` }).returning();
    spaceId = space.id;
    otherSpaceId = other.id;
  }, 600_000);

  beforeEach(async () => {
    await db.delete(s.reviewVideos).where(eq(s.reviewVideos.spaceId, spaceId));
    await db.delete(s.generatedVideos).where(eq(s.generatedVideos.spaceId, spaceId));
  });

  afterAll(async () => {
    await db.delete(s.jobs);
    await db.delete(s.spaces).where(eq(s.spaces.id, spaceId));
    await db.delete(s.spaces).where(eq(s.spaces.id, otherSpaceId));
    await db.delete(s.user).where(eq(s.user.id, owner));
    await pool?.end();
    await releaseLock?.();
  });

  it("shows nothing until the owner switches a video on", async () => {
    await reviewVideo();
    await aiVideo();
    expect(await ids()).toEqual([]);
  });

  it("shows a review video as an MP4 testimonial with its author and verbatim words, and says what it is", async () => {
    const v = await reviewVideo({ showInWidget: true });
    expect(await wv.listWidgetVideos(spaceId)).toEqual([
      {
        id: v.id,
        videoUrl: v.outputUrl,
        platform: "mp4",
        thumbnailUrl: null,
        title: null,
        quote: "Great experience!",
        customerName: "Alice M.",
        customerCompany: null,
        durationSeconds: 12,
        generated: "review",
        badge: "⭐ Review video",
      },
    ]);
  });

  it("names a review video of several reviews for what it is, not after the first author", async () => {
    const many = { reviews: [{ author: "A", text: "one one one one" }, { author: "B", text: "two two two two" }, { author: "C", text: "three three" }], brand: "#cf3d0b" };
    await reviewVideo({ showInWidget: true, template: "stack", props: many });
    expect((await wv.listWidgetVideos(spaceId))[0]).toMatchObject({ customerName: "Customer reviews", quote: null });
  });

  it("shows an AI video under its testimonial's name and quote, labelled as AI-generated", async () => {
    const { v } = await aiVideo({ video: { showInWidget: true } });
    expect(await wv.listWidgetVideos(spaceId)).toEqual([
      expect.objectContaining({ id: v.id, quote: "It saved us a week.", customerName: "Ben K.", customerCompany: "Kiln Ltd", generated: "ai", badge: "AI-generated video", platform: "mp4" }),
    ]);
  });

  it("leaves out anything that is not a finished, live video of this space", async () => {
    const shown = await reviewVideo({ showInWidget: true });
    await reviewVideo({ showInWidget: true, status: "rendering", outputUrl: null });
    await reviewVideo({ showInWidget: true, status: "failed", outputUrl: null });
    await reviewVideo({ showInWidget: true, deletedAt: new Date(), outputUrl: null });
    await reviewVideo({ showInWidget: true, moderatedAt: new Date(), outputUrl: null });
    await reviewVideo({ showInWidget: true, moderatedAt: new Date() }); // even if a stale link were left behind
    await reviewVideo({ showInWidget: true, deletedAt: new Date() });
    await db.insert(s.reviewVideos).values({ spaceId: otherSpaceId, template: "spotlight", status: "done", props: props("X", "other space"), rightsConfirmedAt: new Date(), outputUrl: "https://cdn.test/x.mp4", showInWidget: true });
    expect(await ids()).toEqual([shown.id]);
    expect(await ids(otherSpaceId)).toHaveLength(1);
  });

  it("drops an AI video the moment its customer withdraws consent, a platform admin takes it down, or its testimonial is hidden", async () => {
    const stays = await aiVideo({ video: { showInWidget: true } });
    const withdrawn = await aiVideo({ video: { showInWidget: true } });
    const takenDown = await aiVideo({ video: { showInWidget: true, moderatedAt: new Date(), outputUrl: null } });
    const hidden = await aiVideo({ video: { showInWidget: true }, testimonialActive: false });
    expect(await ids()).toEqual([stays.v.id, withdrawn.v.id]);

    // Consent revoked, with no help from the file or the link having been cleared
    await db.update(s.testimonialConsents).set({ revokedAt: new Date() }).where(eq(s.testimonialConsents.id, withdrawn.c.id));
    expect(await ids()).toEqual([stays.v.id]);
    void takenDown;
    void hidden;
  });

  it("the real withdrawal flow removes it from the widget too", async () => {
    const { v, c } = await aiVideo({ video: { showInWidget: true } });
    expect(await ids()).toEqual([v.id]);
    await withdrawal.withdrawConsent(c.id, "customer");
    expect(await ids()).toEqual([]);
  });

  describe("the owner's switch", () => {
    it("turns a finished video on and off, for both kinds", async () => {
      const r = await reviewVideo();
      const { v } = await aiVideo();
      await wv.setVideoInWidget("review", r.id, spaceId, true);
      await wv.setVideoInWidget("ai", v.id, spaceId, true);
      expect((await ids()).sort()).toEqual([r.id, v.id].sort());
      await wv.setVideoInWidget("review", r.id, spaceId, false);
      expect(await ids()).toEqual([v.id]);
    });

    it("refuses a video that is not finished, was taken down, or belongs to another space; turning off always works", async () => {
      const queued = await reviewVideo({ status: "queued", outputUrl: null });
      const down = await reviewVideo({ moderatedAt: new Date(), outputUrl: null, showInWidget: true });
      const mine = await reviewVideo();
      await expect(wv.setVideoInWidget("review", queued.id, spaceId, true)).rejects.toMatchObject({ status: 400 });
      await expect(wv.setVideoInWidget("review", down.id, spaceId, true)).rejects.toMatchObject({ status: 400 });
      await expect(wv.setVideoInWidget("review", mine.id, otherSpaceId, true)).rejects.toMatchObject({ status: 404 });
      await expect(wv.setVideoInWidget("review", crypto.randomUUID(), spaceId, true)).rejects.toMatchObject({ status: 404 });
      await expect(wv.setVideoInWidget("review", down.id, spaceId, false)).resolves.toBeUndefined();
    });
  });
});
