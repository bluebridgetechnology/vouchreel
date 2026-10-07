import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("worker heartbeats and admin worker health (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let workers: typeof import("../workers");
  let heartbeat: typeof import("@/lib/jobs/heartbeat");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const NOW = new Date("2026-10-06T12:00:00Z");
  const ago = (ms: number) => new Date(NOW.getTime() - ms);

  const beat = (workerId: string, kind: "worker" | "video-worker", lastSeenAt: Date, extra: Record<string, unknown> = {}) =>
    db.insert(s.workerHeartbeats).values({ workerId, kind, startedAt: ago(3_600_000), lastSeenAt, ...extra });
  const job = (type: string, runAt: Date, createdAt = ago(10 * 60_000), status: "queued" | "running" = "queued") =>
    db.insert(s.jobs).values({ type, status, runAt, createdAt });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    workers = await import("../workers");
    heartbeat = await import("@/lib/jobs/heartbeat");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
  }, 600_000);

  beforeEach(async () => {
    await db.delete(s.workerHeartbeats);
    await db.delete(s.jobs);
  });

  afterAll(async () => {
    await db.delete(s.workerHeartbeats);
    await db.delete(s.jobs);
    await pool?.end();
    await releaseLock?.();
  });

  it("a running heartbeat writes its row, refreshes it, and marks a clean stop", async () => {
    const hb = heartbeat.startHeartbeat({ workerId: "it-w1", kind: "video-worker", concurrency: 2, capabilities: { chromium: "ok" }, intervalMs: 50 });
    await new Promise((r) => setTimeout(r, 200));
    const [first] = await db.select().from(s.workerHeartbeats).where(eq(s.workerHeartbeats.workerId, "it-w1"));
    expect(first).toMatchObject({ kind: "video-worker", concurrency: 2, jobsProcessed: 0, capabilities: { chromium: "ok" }, stoppedAt: null });
    expect(first.pid).toBe(process.pid);

    hb.recordProcessed(4);
    await new Promise((r) => setTimeout(r, 200));
    const [second] = await db.select().from(s.workerHeartbeats).where(eq(s.workerHeartbeats.workerId, "it-w1"));
    expect(second.jobsProcessed).toBe(4);
    expect(second.lastSeenAt.getTime()).toBeGreaterThan(first.lastSeenAt.getTime());
    expect(second.startedAt.getTime()).toBe(first.startedAt.getTime());

    await hb.stop();
    const [stopped] = await db.select().from(s.workerHeartbeats).where(eq(s.workerHeartbeats.workerId, "it-w1"));
    expect(stopped.stoppedAt).not.toBeNull();
    // A restart under the same id comes back as running
    const again = heartbeat.startHeartbeat({ workerId: "it-w1", kind: "video-worker", concurrency: 2, intervalMs: 50 });
    await new Promise((r) => setTimeout(r, 150));
    const [restarted] = await db.select().from(s.workerHeartbeats).where(eq(s.workerHeartbeats.workerId, "it-w1"));
    expect(restarted.stoppedAt).toBeNull();
    await again.stop();
  });

  it("lists workers with their status and hides ones not seen for a day", async () => {
    await beat("a", "worker", ago(5_000));
    await beat("b", "video-worker", ago(10 * 60_000));
    await beat("c", "worker", ago(1_000), { stoppedAt: ago(500) });
    await beat("old", "worker", ago(30 * 3_600_000));
    const h = await workers.getWorkerHealth(NOW);
    expect(h.workers.map((w) => [w.workerId, w.status])).toEqual([
      ["c", "stopped"],
      ["a", "online"],
      ["b", "not_responding"],
    ]);
  });

  it("raises a critical alert when review videos wait and no video worker is alive", async () => {
    await beat("gen", "worker", ago(2_000), { capabilities: { ffmpeg: "7.1" } });
    await job("review_video", ago(60_000), ago(12 * 60_000));
    await job("review_video", ago(60_000), ago(3 * 60_000));
    await job("social_export", ago(60_000), ago(30_000));
    const h = await workers.getWorkerHealth(NOW);
    const video = h.kinds.find((k) => k.kind === "video-worker")!;
    const general = h.kinds.find((k) => k.kind === "worker")!;
    expect(video).toMatchObject({ severity: "critical", online: 0, queued: 2 });
    expect(video.oldestQueuedAt?.getTime()).toBe(ago(12 * 60_000).getTime());
    expect(general).toMatchObject({ severity: "ok", online: 1, queued: 1 }); // the social export only counts here
  });

  it("is healthy with a live video worker, ignores jobs scheduled for later and jobs already running", async () => {
    await beat("v", "video-worker", ago(3_000), { capabilities: { chromium: "ok" } });
    await job("review_video", new Date(NOW.getTime() + 3_600_000)); // retry backoff in the future
    await job("review_video", ago(1000), ago(20 * 60_000), "running");
    const video = (await workers.getWorkerHealth(NOW)).kinds.find((k) => k.kind === "video-worker")!;
    expect(video).toMatchObject({ severity: "ok", online: 1, queued: 0 });
  });

  it("flags a live video worker whose Chromium failed to start", async () => {
    await beat("v", "video-worker", ago(3_000), { capabilities: { chromium: "error: Failed to launch the browser process!" } });
    await job("review_video", ago(1000));
    const video = (await workers.getWorkerHealth(NOW)).kinds.find((k) => k.kind === "video-worker")!;
    expect(video.severity).toBe("critical");
    expect(video.message).toContain("Chromium could not start");
  });
});
