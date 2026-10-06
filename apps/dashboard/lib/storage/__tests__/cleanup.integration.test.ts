import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const storage = vi.hoisted(() => ({ deleted: [] as string[], failOn: new Set<string>() }));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    delete: async (key: string) => {
      if (storage.failOn.has(key)) throw new Error(`cannot delete ${key}`);
      storage.deleted.push(key);
    },
  }),
}));
vi.mock("@/lib/social/pipeline", () => ({ renderSocialExport: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: vi.fn(), createNotification: vi.fn() }));

run("file cleanup when rows are deleted (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let del: typeof import("@/lib/spaces/delete");
  let cleanup: typeof import("../cleanup");
  let worker: typeof import("@/lib/jobs/worker");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `cl${Date.now()}`;
  const cdn = "https://cdn.test";
  const owner = `${tag}-owner`;
  const spaceIds: string[] = [];

  const jobKeys = async () => {
    const rows = await db.select().from(s.jobs).where(eq(s.jobs.type, cleanup.FILE_CLEANUP_JOB));
    return rows.flatMap((r) => (r.payload.keys as string[]) ?? []).sort();
  };

  /** A space with one of everything that owns a file. */
  async function seedSpace(name: string) {
    const [space] = await db.insert(s.spaces).values({ name: `${tag} ${name}`, ownerId: owner, embedKey: `${tag}-${name}` }).returning();
    spaceIds.push(space.id);
    const [t] = await db
      .insert(s.testimonials)
      .values({ spaceId: space.id, platform: "mp4", videoUrl: `${cdn}/submissions/${name}/t.mp4`, thumbnailUrl: `${cdn}/submissions/${name}/t.jpg`, clipUrl: `${cdn}/submissions/${name}/clip.mp4` })
      .returning();
    await db.insert(s.socialExports).values({ spaceId: space.id, testimonialId: t.id, format: "tiktok", status: "done", outputUrl: `${cdn}/social-exports/${name}/e.mp4` });
    const [consent] = await (async () => {
      const [text] = await db.insert(s.testimonials).values({ spaceId: space.id, platform: "text", quote: "Great product." }).returning();
      const [c] = await db.insert(s.testimonialConsents).values({ testimonialId: text.id, spaceId: space.id, source: "collect_form", textVersion: "v1", grantedAt: new Date() }).returning();
      return [{ t: text.id, c: c.id }];
    })();
    await db.insert(s.generatedVideos).values({ spaceId: space.id, testimonialId: consent.t, consentId: consent.c, status: "done", template: "b", voice: "v", scriptOriginal: "words words words", outputUrl: `${cdn}/ai-videos/${name}/ai.mp4` });
    await db.insert(s.reviewVideos).values({ spaceId: space.id, template: "spotlight", status: "done", props: {}, rightsConfirmedAt: new Date(), outputUrl: `${cdn}/review-videos/${name}/r.mp4` });
    const [form] = await db.insert(s.collectionForms).values({ spaceId: space.id, title: "f", promptText: "p", slug: `${tag}-${name}` }).returning();
    await db.insert(s.submissions).values({ formId: form.id, type: "video", videoUrl: `${cdn}/submissions/${name}/raw.mp4`, thumbnailUrl: `${cdn}/submissions/${name}/raw.jpg`, customerName: "N", customerEmail: "n@example.test" });
    return { space, testimonial: t, form };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    del = await import("@/lib/spaces/delete");
    cleanup = await import("../cleanup");
    worker = await import("@/lib/jobs/worker");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values({ id: owner, name: "Owner", email: `${owner}@example.test` });
  }, 600_000);

  beforeEach(async () => {
    storage.deleted.length = 0;
    storage.failOn.clear();
    await db.delete(s.jobs);
  });

  afterAll(async () => {
    await db.delete(s.jobs);
    await db.delete(s.generatedVideos).where(inArray(s.generatedVideos.spaceId, spaceIds));
    await db.delete(s.spaces).where(inArray(s.spaces.id, spaceIds));
    await db.delete(s.user).where(eq(s.user.id, owner));
    await pool?.end();
    await releaseLock?.();
  });

  it("deleting a space queues every file it owned, in the same transaction that deletes the rows", async () => {
    const { space } = await seedSpace("a");
    const files = await del.deleteSpace(space.id);
    expect(files).toBe(8); // the testimonial's video, thumbnail and clip, the export, the AI video, the review video, the submission's video and thumbnail
    expect(await jobKeys()).toEqual(
      [
        "submissions/a/t.mp4", "submissions/a/t.jpg", "submissions/a/clip.mp4", "social-exports/a/e.mp4",
        "ai-videos/a/ai.mp4", "review-videos/a/r.mp4", "submissions/a/raw.mp4", "submissions/a/raw.jpg",
      ].sort()
    );
    expect(await db.select().from(s.spaces).where(eq(s.spaces.id, space.id))).toHaveLength(0);
    expect(await db.select().from(s.testimonials).where(eq(s.testimonials.spaceId, space.id))).toHaveLength(0);
  });

  it("the cleanup job deletes the files once the worker runs it", async () => {
    const { space } = await seedSpace("b");
    await del.deleteSpace(space.id);
    expect(storage.deleted).toEqual([]); // nothing happens until a worker picks the job up
    const claimed = await worker.drainQueue({ only: [cleanup.FILE_CLEANUP_JOB] });
    expect(claimed).toBe(1);
    expect(storage.deleted.sort()).toEqual(
      ["submissions/b/t.mp4", "submissions/b/t.jpg", "submissions/b/clip.mp4", "social-exports/b/e.mp4", "ai-videos/b/ai.mp4", "review-videos/b/r.mp4", "submissions/b/raw.mp4", "submissions/b/raw.jpg"].sort()
    );
    const [job] = await db.select().from(s.jobs);
    expect(job.status).toBe("done");
  });

  it("keeps a file that another row still uses (a testimonial made from a submission shares its video)", async () => {
    const { space, form } = await seedSpace("c");
    // The testimonial's video is the same file as a submission in another space's form
    const other = await seedSpace("d");
    await db.update(s.submissions).set({ videoUrl: `${cdn}/submissions/c/t.mp4` }).where(eq(s.submissions.formId, other.form.id));
    await del.deleteSpace(space.id);
    await worker.drainQueue({ only: [cleanup.FILE_CLEANUP_JOB] });
    expect(storage.deleted).not.toContain("submissions/c/t.mp4"); // still referenced
    expect(storage.deleted).toContain("submissions/c/t.jpg");
    expect(form.id).toBeTruthy();
  });

  it("retries when a delete fails: the job fails but the other files are still deleted", async () => {
    const { space } = await seedSpace("e");
    await del.deleteSpace(space.id);
    storage.failOn.add("ai-videos/e/ai.mp4");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await worker.drainQueue({ only: [cleanup.FILE_CLEANUP_JOB] });
    err.mockRestore();
    const [job] = await db.select().from(s.jobs);
    expect(job.status).toBe("queued"); // backing off, will retry
    expect(job.lastError).toContain("ai-videos/e/ai.mp4");
    expect(storage.deleted).toContain("review-videos/e/r.mp4"); // the others went

    storage.failOn.clear();
    await db.update(s.jobs).set({ runAt: new Date() });
    await worker.drainQueue({ only: [cleanup.FILE_CLEANUP_JOB] });
    expect(storage.deleted).toContain("ai-videos/e/ai.mp4");
    expect((await db.select().from(s.jobs))[0].status).toBe("done");
  });

  it("deleting a collection form queues its submissions' files, and only for a form in that space", async () => {
    const { space, form } = await seedSpace("f");
    const other = await seedSpace("g");
    expect(await del.deleteCollectionForm(other.space.id, form.id)).toBeNull(); // wrong space
    expect(await jobKeys()).toEqual([]);
    expect(await db.select().from(s.collectionForms).where(eq(s.collectionForms.id, form.id))).toHaveLength(1);

    expect(await del.deleteCollectionForm(space.id, form.id)).toEqual({ files: 2 });
    expect(await jobKeys()).toEqual(["submissions/f/raw.jpg", "submissions/f/raw.mp4"]);
    expect(await db.select().from(s.submissions).where(eq(s.submissions.formId, form.id))).toHaveLength(0);
  });

  it("permanently deleting a testimonial queues its files, its exports' files and its AI videos' files", async () => {
    const { space, testimonial } = await seedSpace("h");
    expect(await del.deleteTestimonialPermanently(space.id, "00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await del.deleteTestimonialPermanently((await seedSpace("i")).space.id, testimonial.id)).toBeNull(); // wrong space
    expect(await jobKeys()).toEqual([]);

    const deleted = await del.deleteTestimonialPermanently(space.id, testimonial.id);
    expect(deleted?.id).toBe(testimonial.id);
    expect(await jobKeys()).toEqual(["social-exports/h/e.mp4", "submissions/h/clip.mp4", "submissions/h/t.jpg", "submissions/h/t.mp4"]);
  });

  it("skips URLs that are not ours and splits large lists into several jobs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const urls = Array.from({ length: 230 }, (_, i) => `${cdn}/ai-videos/bulk/${i}.mp4`);
    expect(await cleanup.queueFileCleanup([...urls, `${cdn}/somewhere/else.mp4`, null, undefined, urls[0]])).toBe(230);
    warn.mockRestore();
    const jobs = await db.select().from(s.jobs);
    expect(jobs.map((j) => (j.payload.keys as string[]).length).sort((a, b) => a - b)).toEqual([30, 100, 100]);
  });
});
