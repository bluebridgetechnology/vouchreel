import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Runs against a real Postgres (the `jobs` migration must be applied). Skipped unless
 * TEST_DATABASE_URL is set, so CI without a database stays green:
 *   TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard
 */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("job queue (postgres)", () => {
  let queue: typeof import("../queue");
  let db: typeof import("@/lib/db").db;
  let jobs: typeof import("@/lib/db/schema").jobs;
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    queue = await import("../queue");
    ({ db } = await import("@/lib/db"));
    ({ jobs } = await import("@/lib/db/schema"));
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
  }, 600_000);

  beforeEach(async () => {
    await db.delete(jobs);
  });

  afterAll(async () => {
    await db.delete(jobs);
    await pool?.end();
    await releaseLock?.();
  });

  it("claims each job exactly once across concurrent workers", async () => {
    for (let i = 0; i < 20; i++) await queue.enqueueJob("t", { i });

    const claimed = (
      await Promise.all(Array.from({ length: 40 }, (_, i) => queue.claimJob(`w${i % 5}`)))
    ).filter((j) => j !== null);

    expect(claimed).toHaveLength(20);
    expect(new Set(claimed.map((j) => j!.id)).size).toBe(20);
    expect(claimed.every((j) => j!.attempts === 1 && j!.status === "running")).toBe(true);
  });

  it("claims only the requested job types, and never the excluded ones", async () => {
    await queue.enqueueJob("render", { n: 1 });
    await queue.enqueueJob("render", { n: 2 });
    await queue.enqueueJob("other", { n: 3 });

    expect(await queue.claimJob("w", { except: ["render"] })).toMatchObject({ type: "other" });
    expect(await queue.claimJob("w", { except: ["render"] })).toBeNull();
    expect(await queue.claimJob("w", { only: ["other"] })).toBeNull();
    expect(await queue.claimJob("w", { only: ["render"] })).toMatchObject({ type: "render" });
    expect(await queue.claimJob("w")).toMatchObject({ type: "render" });
  });

  it("does not claim jobs scheduled in the future", async () => {
    await queue.enqueueJob("t", {}, { runAt: new Date(Date.now() + 60_000) });
    expect(await queue.claimJob("w")).toBeNull();
  });

  it("requeues with backoff, then fails after maxAttempts", async () => {
    await queue.enqueueJob("t", {}, { maxAttempts: 2 });

    const first = (await queue.claimJob("w"))!;
    expect(await queue.failJob(first, new Error("x"))).toBe("retry");
    expect(await queue.claimJob("w")).toBeNull(); // backoff not elapsed

    await db.update(jobs).set({ runAt: new Date(Date.now() - 1000) });
    const second = (await queue.claimJob("w"))!;
    expect(second.attempts).toBe(2);
    expect(await queue.failJob(second, new Error("y"))).toBe("failed");

    const [row] = await db.select().from(jobs);
    expect(row.status).toBe("failed");
    expect(row.lastError).toBe("y");
  });

  it("reclaims stale running jobs and fails exhausted ones", async () => {
    await queue.enqueueJob("t", {});
    await queue.enqueueJob("t", {}, { maxAttempts: 1 });
    await queue.claimJob("dead");
    await queue.claimJob("dead");
    await db.update(jobs).set({ lockedAt: new Date(Date.now() - 60 * 60 * 1000) });

    expect(await queue.reclaimStaleJobs()).toBe(2);
    const rows = await db.select().from(jobs);
    expect(rows.map((r) => r.status).sort()).toEqual(["failed", "queued"]);
  });
});
