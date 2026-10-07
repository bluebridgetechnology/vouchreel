import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * The real S3 adapter against an S3-compatible server (moto, MinIO, ...). Skipped unless
 * S3_TEST_ENDPOINT is set, e.g.:
 *   moto_server -p 5555 &   S3_TEST_ENDPOINT=http://127.0.0.1:5555 npm test -w apps/dashboard
 * The orphan test also needs TEST_DATABASE_URL.
 */
const endpoint = process.env.S3_TEST_ENDPOINT;
const run = endpoint ? describe : describe.skip;
const withDb = process.env.TEST_DATABASE_URL ? it : it.skip;

run("S3 adapter against a real S3 protocol server", () => {
  const bucket = `vouchreel-test-${Date.now()}`;
  let adapter: import("../s3").S3Adapter;
  let releaseLock: (() => Promise<void>) | undefined;
  let pool: { end: () => Promise<void> } | undefined;

  const listAll = async (prefix: string) => {
    const out = [];
    for await (const f of adapter.list(prefix)) out.push(f);
    return out;
  };

  beforeAll(async () => {
    Object.assign(process.env, { STORAGE_ENDPOINT: endpoint, STORAGE_BUCKET: bucket, STORAGE_KEY: "test", STORAGE_SECRET: "test", STORAGE_REGION: "us-east-1" });
    await new S3Client({ region: "us-east-1", endpoint, credentials: { accessKeyId: "test", secretAccessKey: "test" }, forcePathStyle: true }).send(
      new CreateBucketCommand({ Bucket: bucket })
    );
    const { S3Adapter } = await import("../s3");
    adapter = new S3Adapter();
    if (process.env.TEST_DATABASE_URL) {
      process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
      releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(process.env.TEST_DATABASE_URL);
    }
  }, 60_000);

  afterAll(async () => {
    if (process.env.TEST_DATABASE_URL) {
      pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
      await pool?.end();
      await releaseLock?.();
    }
  });

  it("uploads, returns the public URL the app stores, and the key can be recovered from it", async () => {
    const url = await adapter.upload(Buffer.from("hello"), "ai-videos/sp/t/v-1.mp4", { contentType: "video/mp4", public: true });
    expect(url).toBe(`${endpoint}/${bucket}/ai-videos/sp/t/v-1.mp4`);
    const { storageKeyFromUrl } = await import("../video-files");
    expect(storageKeyFromUrl(url, "ai")).toBe("ai-videos/sp/t/v-1.mp4");
    const body = await fetch(url);
    expect(body.status).toBe(200);
    expect(await body.text()).toBe("hello");
  });

  it("deletes a file, so its public URL stops working, and deleting it again is not an error", async () => {
    const url = await adapter.upload(Buffer.from("x"), "review-videos/sp/v-2.mp4", { public: true });
    expect((await fetch(url)).status).toBe(200);
    await adapter.delete("review-videos/sp/v-2.mp4");
    expect((await fetch(url)).status).toBe(404);
    await expect(adapter.delete("review-videos/sp/v-2.mp4")).resolves.toBeUndefined();
    await expect(adapter.delete("never/existed.mp4")).resolves.toBeUndefined();
  });

  it("lists by prefix with sizes and dates, across more than one page of results", async () => {
    const batch = 1010; // S3 returns at most 1000 keys per page
    for (let i = 0; i < batch; i += 100) {
      await Promise.all(Array.from({ length: Math.min(100, batch - i) }, (_, j) => adapter.upload(Buffer.from("12345"), `social-exports/bulk/${String(i + j).padStart(5, "0")}.mp4`)));
    }
    await adapter.upload(Buffer.from("zz"), "submissions/other.mp4");
    const bulk = await listAll("social-exports/");
    expect(bulk).toHaveLength(batch);
    expect(new Set(bulk.map((f) => f.key)).size).toBe(batch);
    expect(bulk[0]).toMatchObject({ size: 5 });
    expect(Math.abs(bulk[0].lastModified.getTime() - Date.now())).toBeLessThan(5 * 60_000);
    expect((await listAll("submissions/")).map((f) => f.key)).toEqual(["submissions/other.mp4"]);
    expect(await listAll("nothing-here/")).toEqual([]);
  }, 120_000);

  withDb("the orphan finder compares real storage with the database, and the prune deletes only orphans", async () => {
    const { db } = await import("@/lib/db");
    const s = await import("@/lib/db/schema");
    const { inArray, eq } = await import("drizzle-orm");
    const { findOrphanedFiles, deleteOrphanedFiles } = await import("../orphans");
    const tag = `orph${Date.now()}`;
    await db.insert(s.user).values({ id: tag, name: "O", email: `${tag}@example.test` });
    const [space] = await db.insert(s.spaces).values({ name: tag, ownerId: tag, embedKey: tag }).returning();
    try {
      const keep = `review-videos/${tag}/keep.mp4`;
      const orphan = `review-videos/${tag}/orphan.mp4`;
      const keepUrl = await adapter.upload(Buffer.from("k"), keep, { public: true });
      await adapter.upload(Buffer.from("o"), orphan, { public: true });
      await db.insert(s.reviewVideos).values({ spaceId: space.id, template: "spotlight", status: "done", props: {}, rightsConfirmedAt: new Date(), outputUrl: keepUrl });

      // A day after upload, with the default grace period: the unreferenced file is an orphan
      const later = new Date(Date.now() + 25 * 3_600_000);
      const report = await findOrphanedFiles({ storage: adapter, now: later });
      const mine = report.orphans.filter((f) => f.key.includes(tag));
      expect(mine.map((f) => f.key)).toEqual([orphan]);
      expect(report.referenced).toBeGreaterThanOrEqual(1);

      // Right now it is too new to judge, so nothing is reported
      const fresh = await findOrphanedFiles({ storage: adapter });
      expect(fresh.orphans.filter((f) => f.key.includes(tag))).toEqual([]);
      expect(fresh.tooNew).toBeGreaterThanOrEqual(1);

      const result = await deleteOrphanedFiles(mine, adapter);
      expect(result).toEqual({ deleted: 1, failed: [] });
      expect((await fetch(keepUrl)).status).toBe(200);
      expect((await fetch(`${endpoint}/${bucket}/${orphan}`)).status).toBe(404);
    } finally {
      await db.delete(s.reviewVideos).where(inArray(s.reviewVideos.spaceId, [space.id]));
      await db.delete(s.spaces).where(eq(s.spaces.id, space.id));
      await db.delete(s.user).where(eq(s.user.id, tag));
    }
  });
});
