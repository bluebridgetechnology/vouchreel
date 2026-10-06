import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Real Postgres and real FFmpeg. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const uploads: string[] = [];
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    upload: async (_buf: Buffer, key: string) => {
      uploads.push(key);
      return `https://cdn.test/${key}`;
    },
  }),
}));
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: vi.fn(), createNotification: vi.fn() }));

run("transcoding a submission (postgres + ffmpeg)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let transcodeSubmission: typeof import("../transcode").transcodeSubmission;
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `tc${Date.now()}`;
  let dir = "";
  let realFetch: typeof fetch;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    ({ transcodeSubmission } = await import("../transcode"));
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values({ id: tag, name: "T", email: `${tag}@example.test` });
    dir = mkdtempSync(path.join(os.tmpdir(), "transcode-test-"));
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=15", "-f", "lavfi", "-i", "sine=duration=2", "-shortest", "-pix_fmt", "yuv420p", path.join(dir, "raw.mp4")]);
    realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      String(input).startsWith("https://cdn.test/")
        ? new Response(readFileSync(path.join(dir, "raw.mp4")), { status: 200, headers: { "content-type": "video/mp4" } })
        : realFetch(input, init)) as typeof fetch;
  }, 600_000);

  afterAll(async () => {
    globalThis.fetch = realFetch;
    rmSync(dir, { recursive: true, force: true });
    await db.delete(s.jobs);
    await db.delete(s.spaces).where(eq(s.spaces.ownerId, tag));
    await db.delete(s.user).where(eq(s.user.id, tag));
    await pool?.end();
    await releaseLock?.();
  });

  it("replaces the raw upload with the transcoded copy and queues the raw file for deletion", async () => {
    await db.delete(s.jobs);
    const [space] = await db.insert(s.spaces).values({ name: tag, ownerId: tag, embedKey: tag }).returning();
    const [form] = await db.insert(s.collectionForms).values({ spaceId: space.id, title: "f", promptText: "p", slug: tag }).returning();
    const rawUrl = `https://cdn.test/submissions/${form.id}/raw-${tag}.webm`;
    const [sub] = await db
      .insert(s.submissions)
      .values({ formId: form.id, type: "video", videoUrl: rawUrl, customerName: "N", customerEmail: "n@example.test", processingStatus: "pending" })
      .returning();

    await transcodeSubmission(sub.id);

    const [after] = await db.select().from(s.submissions).where(eq(s.submissions.id, sub.id));
    expect(after.processingStatus).toBe("done");
    expect(after.videoUrl).not.toBe(rawUrl);
    expect(after.videoUrl).toMatch(new RegExp(`/submissions/${sub.id}/.+\\.mp4$`));
    const jobs = await db.select().from(s.jobs).where(eq(s.jobs.type, "file_cleanup"));
    expect(jobs.flatMap((j) => j.payload.keys as string[])).toEqual([`submissions/${form.id}/raw-${tag}.webm`]);
    // The transcoded copy is not queued: it is what the submission points at now
    expect(uploads.some((k) => jobs.some((j) => (j.payload.keys as string[]).includes(k)))).toBe(false);
  }, 120_000);
});
