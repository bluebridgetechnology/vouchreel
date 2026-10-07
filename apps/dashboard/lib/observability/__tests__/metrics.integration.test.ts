import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("collected metrics (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let s: typeof import("@/lib/db/schema");
  let metrics: typeof import("../metrics");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const now = new Date();

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    s = await import("@/lib/db/schema");
    metrics = await import("../metrics");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.delete(s.jobs);
    await db.delete(s.workerHeartbeats);
    await db.insert(s.jobs).values([
      { type: "review_video", payload: {}, status: "queued", runAt: new Date(now.getTime() - 120_000), createdAt: new Date(now.getTime() - 120_000) },
      { type: "file_cleanup", payload: {}, status: "queued", runAt: new Date(now.getTime() - 10_000), createdAt: new Date(now.getTime() - 10_000) },
      { type: "file_cleanup", payload: {}, status: "queued", runAt: new Date(now.getTime() + 3_600_000) }, // not ready yet
      { type: "file_cleanup", payload: {}, status: "failed" },
      { type: "file_cleanup", payload: {}, status: "running", lockedBy: "w", lockedAt: new Date(now.getTime() - 3_600_000) }, // stale
      { type: "file_cleanup", payload: {}, status: "running", lockedBy: "w", lockedAt: new Date(now.getTime() - 5_000) },
    ]);
    await db.insert(s.workerHeartbeats).values({ workerId: "m-w1", kind: "worker", concurrency: 1, jobsProcessed: 0, capabilities: {}, startedAt: now, lastSeenAt: now });
  }, 600_000);

  afterAll(async () => {
    await db.delete(s.jobs);
    await db.delete(s.workerHeartbeats);
    await pool?.end();
    await releaseLock?.();
  });

  const value = (all: Awaited<ReturnType<typeof metrics.collectMetrics>>, name: string, labels?: Record<string, string>) =>
    all.find((m) => m.name === name)!.samples.find((x) => !labels || Object.entries(labels).every(([k, v]) => x.labels?.[k] === v))!.value;

  it("counts jobs, the oldest ready one, stale locks and workers", async () => {
    const all = await metrics.collectMetrics(now);
    expect(value(all, "vouchreel_up")).toBe(1);
    expect(value(all, "vouchreel_jobs", { type: "file_cleanup", status: "queued" })).toBe(2);
    expect(value(all, "vouchreel_jobs", { type: "review_video", status: "queued" })).toBe(1);
    expect(value(all, "vouchreel_jobs", { type: "file_cleanup", status: "failed" })).toBe(1);
    expect(value(all, "vouchreel_jobs", { type: "file_cleanup", status: "running" })).toBe(2);
    expect(value(all, "vouchreel_jobs_oldest_queued_age_seconds")).toBe(120);
    expect(value(all, "vouchreel_jobs_stale_running")).toBe(1);
    expect(value(all, "vouchreel_workers_online", { kind: "worker" })).toBe(1);
    expect(value(all, "vouchreel_workers_online", { kind: "video-worker" })).toBe(0);
    // A video is waiting and there is no video worker: critical
    expect(value(all, "vouchreel_worker_severity", { kind: "video-worker" })).toBe(2);
    expect(value(all, "vouchreel_worker_queue", { kind: "video-worker" })).toBe(1);
  });

  it("renders to text that Prometheus can read, with every line well formed", async () => {
    const text = metrics.renderPrometheus(await metrics.collectMetrics(now));
    for (const line of text.trim().split("\n")) {
      expect(line).toMatch(/^(# (HELP|TYPE) \w+ .+|\w+(\{[^}]*\})? -?\d+(\.\d+)?)$/);
    }
  });
});
