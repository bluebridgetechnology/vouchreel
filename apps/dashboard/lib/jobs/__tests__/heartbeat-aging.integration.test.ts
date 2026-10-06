import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real Postgres, real time-based rows. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("worker rows age out (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let like: typeof import("drizzle-orm").like;
  let s: typeof import("@/lib/db/schema");
  let health: typeof import("@/lib/admin/workers");
  let hb: typeof import("../heartbeat");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `aging${Date.now()}`;
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ like } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    health = await import("@/lib/admin/workers");
    hb = await import("../heartbeat");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.delete(s.workerHeartbeats);
    const base = { kind: "worker" as const, concurrency: 1, jobsProcessed: 0, capabilities: {}, startedAt: hoursAgo(300) };
    await db.insert(s.workerHeartbeats).values([
      { ...base, workerId: `${tag}-fresh`, lastSeenAt: new Date() },
      { ...base, workerId: `${tag}-20h`, lastSeenAt: hoursAgo(20), stoppedAt: hoursAgo(20) },
      { ...base, workerId: `${tag}-30h`, lastSeenAt: hoursAgo(30) },
      { ...base, workerId: `${tag}-6d`, lastSeenAt: hoursAgo(6 * 24) },
      { ...base, workerId: `${tag}-8d`, lastSeenAt: hoursAgo(8 * 24) },
    ]);
  }, 600_000);

  afterAll(async () => {
    await db.delete(s.workerHeartbeats).where(like(s.workerHeartbeats.workerId, `${tag}%`));
    await pool?.end();
    await releaseLock?.();
  });

  it("lists workers seen within 24 hours and hides older ones", async () => {
    const ids = (await health.getWorkerHealth()).workers.map((w) => w.workerId).filter((id) => id.startsWith(tag));
    expect(ids.sort()).toEqual([`${tag}-20h`, `${tag}-fresh`].sort());
  });

  it("starting a worker deletes rows older than 7 days and keeps the rest", async () => {
    const beat = hb.startHeartbeat({ workerId: `${tag}-new`, kind: "worker", concurrency: 1 });
    await new Promise((r) => setTimeout(r, 500));
    await beat.stop();
    const left = (await db.select({ id: s.workerHeartbeats.workerId }).from(s.workerHeartbeats).where(like(s.workerHeartbeats.workerId, `${tag}%`))).map((r) => r.id);
    expect(left).not.toContain(`${tag}-8d`);
    expect(left).toEqual(expect.arrayContaining([`${tag}-6d`, `${tag}-30h`, `${tag}-new`]));
  });
});
