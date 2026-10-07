import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Real Postgres (migrations applied) plus, for the render test, a real FFmpeg. Skipped unless
 * TEST_DATABASE_URL is set:  TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard
 * Storage and plan lookup are stubbed; narration uses the mock provider.
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
  getSubscriptionLimits: async () => ({ aiVideoCredits: monthlyCredits, removeWatermark: false }),
}));
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: vi.fn(), createNotification: vi.fn() }));

run("AI video generate flow (postgres)", () => {
  type Db = typeof import("@/lib/db").db;
  let db: Db;
  let s: typeof import("@/lib/db/schema");
  let gen: typeof import("../generate");
  let render: typeof import("../render");
  let credits: typeof import("../credits");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const ids = { user: `ai-test-${Date.now()}`, space: "", testimonial: "", consent: "" };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.AI_VIDEO_TTS_PROVIDER = "mock";
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    s = await import("@/lib/db/schema");
    gen = await import("../generate");
    render = await import("../render");
    credits = await import("../credits");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;

    await db.insert(s.user).values({ id: ids.user, name: "AI Test", email: `${ids.user}@example.test` });
    const [space] = await db.insert(s.spaces).values({ name: "AI test", ownerId: ids.user, embedKey: ids.user }).returning();
    ids.space = space.id;
    const [t] = await db
      .insert(s.testimonials)
      .values({
        spaceId: space.id,
        platform: "text",
        quote: "Great product. It saved us hours every single week and the support team was wonderful.",
        customerName: "Ada Lovelace",
        customerCompany: "Analytical Co",
      })
      .returning();
    ids.testimonial = t.id;
  }, 600_000);

  beforeEach(async () => {
    monthlyCredits = 2;
    uploads.length = 0;
    await db.delete(s.generatedVideos);
    await db.delete(s.testimonialConsents);
    await db.delete(s.jobs);
    const [consent] = await db
      .insert(s.testimonialConsents)
      .values({ testimonialId: ids.testimonial, spaceId: ids.space, source: "collect_form", textVersion: "v1", grantedAt: new Date() })
      .returning();
    ids.consent = consent.id;
  });

  afterAll(async () => {
    await db.delete(s.generatedVideos);
    await db.delete(s.testimonialConsents);
    await db.delete(s.jobs);
    await db.delete(s.user).where((await import("drizzle-orm")).eq(s.user.id, ids.user)); // cascades space + testimonial
    await pool?.end();
    await releaseLock?.();
  });

  const draft = (over: Partial<Parameters<typeof gen.createDraft>[0]> = {}) =>
    gen.createDraft({ spaceId: ids.space, testimonialId: ids.testimonial, userId: ids.user, template: "bold", voice: "warm", aspect: "9:16", ...over });

  it("creates a draft with a proposed trim and spends no credit", async () => {
    const { video, credits: c } = await draft();
    expect(video.status).toBe("draft");
    expect(video.scriptTrimmed).toBeTruthy();
    expect(video.consentId).toBe(ids.consent);
    expect(c.used).toBe(0);
  });

  it("refuses without consent, and after consent is revoked", async () => {
    await db.update(s.testimonialConsents).set({ revokedAt: new Date() });
    await expect(draft()).rejects.toMatchObject({ status: 403 });

    await db.update(s.testimonialConsents).set({ revokedAt: null });
    const { video } = await draft();
    await db.update(s.testimonialConsents).set({ revokedAt: new Date() });
    await expect(gen.approveDraft({ videoId: video.id, spaceId: ids.space })).rejects.toMatchObject({ status: 403 });
  });

  it("refuses when the plan has no AI video credits", async () => {
    monthlyCredits = 0;
    await expect(draft()).rejects.toMatchObject({ code: "PLAN_LIMIT" });
  });

  it("refuses non-text testimonials, bad templates and fake translations", async () => {
    await expect(draft({ template: "nope" })).rejects.toMatchObject({ status: 400 });
    await expect(draft({ language: "es" })).rejects.toMatchObject({ status: 400 });
    await db.insert(s.testimonialTranslations).values({ testimonialId: ids.testimonial, language: "es", quote: "[ES] Great product", provider: "mock" });
    await expect(draft({ language: "es" })).rejects.toMatchObject({ status: 400 });
    await db.delete(s.testimonialTranslations);
  });

  it("approve takes a credit, queues exactly one job and records the approved script", async () => {
    const { video } = await draft();
    const approved = await gen.approveDraft({ videoId: video.id, spaceId: ids.space, script: "Great product. It saved us hours every single week." });
    expect(approved.status).toBe("queued");
    expect(approved.trimApprovedAt).toBeTruthy();
    expect(approved.scriptTrimmed).toBe("Great product. It saved us hours every single week.");

    const queued = await db.select().from(s.jobs);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ type: "ai_video", payload: { videoId: video.id }, status: "queued" });
    expect((await credits.getAiVideoCredits(ids.user)).used).toBe(1);
  });

  it("rejects an edited script that adds or changes words", async () => {
    const { video } = await draft();
    await expect(gen.approveDraft({ videoId: video.id, spaceId: ids.space, script: "Great product. It saved us days every single week." })).rejects.toMatchObject({ status: 422 });
    expect(await db.select().from(s.jobs)).toHaveLength(0);
  });

  it("cannot approve twice", async () => {
    const { video } = await draft();
    await gen.approveDraft({ videoId: video.id, spaceId: ids.space });
    await expect(gen.approveDraft({ videoId: video.id, spaceId: ids.space })).rejects.toMatchObject({ status: 400 });
    expect(await db.select().from(s.jobs)).toHaveLength(1);
  });

  it("never lets concurrent approvals overspend the monthly credits", async () => {
    monthlyCredits = 2;
    const drafts = await Promise.all(Array.from({ length: 5 }, () => draft()));
    const results = await Promise.allSettled(drafts.map((d) => gen.approveDraft({ videoId: d.video.id, spaceId: ids.space })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason.code === "PLAN_LIMIT")).toBe(true);
    expect(await db.select().from(s.jobs)).toHaveLength(2);
  });

  it("a failed video frees its credit", async () => {
    monthlyCredits = 1;
    const first = (await draft()).video;
    await gen.approveDraft({ videoId: first.id, spaceId: ids.space });
    const second = (await draft()).video;
    await expect(gen.approveDraft({ videoId: second.id, spaceId: ids.space })).rejects.toMatchObject({ code: "PLAN_LIMIT" });

    await db.update(s.generatedVideos).set({ status: "failed" }).where((await import("drizzle-orm")).eq(s.generatedVideos.id, first.id));
    await expect(gen.approveDraft({ videoId: second.id, spaceId: ids.space })).resolves.toMatchObject({ status: "queued" });
  });

  it("deleting a finished video keeps its credit used, deletes its file, and removes drafts and failed ones", async () => {
    const eq = (await import("drizzle-orm")).eq;
    deletedKeys.length = 0;
    const done = (await draft()).video;
    await gen.approveDraft({ videoId: done.id, spaceId: ids.space });
    const key = `ai-videos/${ids.space}/${done.testimonialId}/${done.id}-abc.mp4`;
    await db.update(s.generatedVideos).set({ status: "done", outputUrl: `https://cdn.test/${key}` }).where(eq(s.generatedVideos.id, done.id));
    expect(await gen.removeVideo(done.id, ids.space)).toBe("archived");
    expect(deletedKeys).toEqual([key]); // the public file is gone, not just the link in the database
    const [row] = await db.select().from(s.generatedVideos).where(eq(s.generatedVideos.id, done.id));
    expect(row.deletedAt).toBeTruthy();
    expect(row.outputUrl).toBeNull();
    expect((await credits.getAiVideoCredits(ids.user)).used).toBe(1);
    await expect(gen.removeVideo(done.id, ids.space)).rejects.toMatchObject({ status: 404 });
    expect(deletedKeys).toHaveLength(1); // the second attempt did not touch storage

    const unused = (await draft()).video;
    expect(await gen.removeVideo(unused.id, ids.space)).toBe("removed");
    expect(await db.select().from(s.generatedVideos).where(eq(s.generatedVideos.id, unused.id))).toHaveLength(0);
    expect(deletedKeys).toHaveLength(1); // drafts have no file

    const inFlight = (await draft()).video;
    await gen.approveDraft({ videoId: inFlight.id, spaceId: ids.space });
    await expect(gen.removeVideo(inFlight.id, ids.space)).rejects.toMatchObject({ status: 400 });
  });

  it("leaves a finished video as it was when its file cannot be deleted, and succeeds on retry", async () => {
    const eq = (await import("drizzle-orm")).eq;
    deletedKeys.length = 0;
    const done = (await draft()).video;
    await gen.approveDraft({ videoId: done.id, spaceId: ids.space });
    const url = `https://cdn.test/ai-videos/${ids.space}/${done.testimonialId}/${done.id}-abc.mp4`;
    await db.update(s.generatedVideos).set({ status: "done", outputUrl: url }).where(eq(s.generatedVideos.id, done.id));

    failDelete = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(gen.removeVideo(done.id, ids.space)).rejects.toMatchObject({ status: 502 });
    err.mockRestore();
    failDelete = false;
    const [untouched] = await db.select().from(s.generatedVideos).where(eq(s.generatedVideos.id, done.id));
    expect(untouched.deletedAt).toBeNull();
    expect(untouched.outputUrl).toBe(url); // still there to retry against

    expect(await gen.removeVideo(done.id, ids.space)).toBe("archived");
    expect(deletedKeys).toHaveLength(1);
  });

  it("only counts approvals from this calendar month", async () => {
    const { video } = await draft();
    await gen.approveDraft({ videoId: video.id, spaceId: ids.space });
    const nextMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 2));
    expect((await credits.getAiVideoCredits(ids.user, db, nextMonth)).used).toBe(0);
  });

  it("renders a real MP4 with narration, captions and the disclosure, then uploads it", async () => {
    const { getFfmpegStatus } = await import("@/lib/media/ffmpeg");
    const ffmpeg = await getFfmpegStatus(true);
    if (!ffmpeg.available || !ffmpeg.drawtext) return; // environment lacks ffmpeg: covered by the unit tests

    const { video } = await draft();
    const approved = await gen.approveDraft({ videoId: video.id, spaceId: ids.space });
    await render.renderGeneratedVideo(approved.id);

    const [done] = await db.select().from(s.generatedVideos).where((await import("drizzle-orm")).eq(s.generatedVideos.id, video.id));
    expect(done.status).toBe("done");
    expect(done.outputUrl).toMatch(/^https:\/\/cdn\.test\/ai-videos\//);
    expect(done.durationSeconds).toBeGreaterThan(0);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].size).toBeGreaterThan(5_000);
  }, 120_000);

  it("settles a render for a consent that was revoked after approval, without rendering", async () => {
    const { video } = await draft();
    await gen.approveDraft({ videoId: video.id, spaceId: ids.space });
    await db.update(s.testimonialConsents).set({ revokedAt: new Date() });
    await render.renderGeneratedVideo(video.id);

    const [row] = await db.select().from(s.generatedVideos).where((await import("drizzle-orm")).eq(s.generatedVideos.id, video.id));
    expect(row.status).toBe("failed");
    expect(row.error).toMatch(/withdrew/);
    expect(uploads).toHaveLength(0);
  });
});
