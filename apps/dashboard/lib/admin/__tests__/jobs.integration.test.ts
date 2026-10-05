import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const notified = vi.fn();
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: (...a: unknown[]) => notified(...a), createNotification: vi.fn() }));

run("admin job actions (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let admin: typeof import("../jobs");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const ids = { user: `adm-jobs-${Date.now()}`, space: "" };

  async function video(status: "queued" | "rendering" | "done" | "failed") {
    const [v] = await db
      .insert(s.reviewVideos)
      .values({ spaceId: ids.space, template: "spotlight", status, props: {}, rightsConfirmedAt: new Date(), error: status === "failed" ? "boom" : null })
      .returning();
    return v;
  }
  async function job(over: Partial<typeof import("@/lib/db/schema").jobs.$inferInsert>, videoId?: string) {
    const [j] = await db
      .insert(s.jobs)
      .values({ type: "review_video", payload: videoId ? { videoId } : {}, ...over })
      .returning();
    return j;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    admin = await import("../jobs");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values({ id: ids.user, name: "Adm", email: `${ids.user}@example.test` });
    const [space] = await db.insert(s.spaces).values({ name: "Adm space", ownerId: ids.user, embedKey: ids.user }).returning();
    ids.space = space.id;
  }, 600_000);

  beforeEach(async () => {
    notified.mockClear();
    await db.delete(s.reviewVideos);
    await db.delete(s.jobs);
  });

  afterAll(async () => {
    await db.delete(s.reviewVideos);
    await db.delete(s.jobs);
    await db.delete(s.spaces).where(eq(s.spaces.id, ids.space));
    await db.delete(s.user).where(eq(s.user.id, ids.user));
    await pool?.end();
    await releaseLock?.();
  });

  it("summarises counts, oldest queued, failed and stuck jobs", async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000);
    await job({ status: "queued", createdAt: old });
    await job({ status: "failed", lastError: "no chromium", completedAt: new Date() });
    await job({ status: "done" });
    await job({ status: "running", lockedAt: new Date(Date.now() - 20 * 60 * 1000), lockedBy: "w1" });
    await job({ status: "running", lockedAt: new Date(), lockedBy: "w2" });

    const o = await admin.getJobOverview();
    expect(o.byStatus).toEqual({ queued: 1, running: 2, done: 1, failed: 1 });
    expect(o.staleRunning).toBe(1);
    expect(o.oldestQueuedAt?.getTime()).toBe(old.getTime());
    expect(o.failed).toHaveLength(1);
    expect(o.failed[0].lastError).toBe("no chromium");
    expect(o.active[0].stale).toBe(true); // stuck jobs sort first
  });

  it("retries a failed job and puts its video back in the queue", async () => {
    const v = await video("failed");
    const j = await job({ status: "failed", attempts: 3, lastError: "x", completedAt: new Date() }, v.id);

    const r = await admin.retryJob(j.id);
    expect(r.ok).toBe(true);
    const [after] = await db.select().from(s.jobs).where(eq(s.jobs.id, j.id));
    expect(after).toMatchObject({ status: "queued", attempts: 0, lastError: null, completedAt: null });
    const [vAfter] = await db.select().from(s.reviewVideos).where(eq(s.reviewVideos.id, v.id));
    expect(vAfter).toMatchObject({ status: "queued", error: null, completedAt: null });
  });

  it("refuses to retry a job that has not failed, and reports a missing job", async () => {
    const j = await job({ status: "queued" });
    expect(await admin.retryJob(j.id)).toMatchObject({ ok: false, reason: "invalid_state" });
    expect(await admin.retryJob("00000000-0000-4000-8000-000000000000")).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("cancels a queued job, fails its video and tells the owner", async () => {
    const v = await video("queued");
    const j = await job({ status: "queued" }, v.id);

    const r = await admin.cancelJob(j.id);
    expect(r.ok).toBe(true);
    const [after] = await db.select().from(s.jobs).where(eq(s.jobs.id, j.id));
    expect(after).toMatchObject({ status: "failed", lastError: "Cancelled by an administrator" });
    const [vAfter] = await db.select().from(s.reviewVideos).where(eq(s.reviewVideos.id, v.id));
    expect(vAfter.status).toBe("failed");
    expect(notified).toHaveBeenCalledTimes(1);
  });

  it("cancels a running job only when its lock is stale", async () => {
    const live = await job({ status: "running", lockedAt: new Date(), lockedBy: "w" });
    expect(await admin.cancelJob(live.id)).toMatchObject({ ok: false, reason: "invalid_state" });
    const [still] = await db.select().from(s.jobs).where(eq(s.jobs.id, live.id));
    expect(still.status).toBe("running");

    const dead = await job({ status: "running", lockedAt: new Date(Date.now() - 30 * 60 * 1000), lockedBy: "w" });
    expect((await admin.cancelJob(dead.id)).ok).toBe(true);
  });

  it("does not touch a video that already finished", async () => {
    const v = await video("done");
    const j = await job({ status: "queued" }, v.id);
    await admin.cancelJob(j.id);
    const [vAfter] = await db.select().from(s.reviewVideos).where(eq(s.reviewVideos.id, v.id));
    expect(vAfter.status).toBe("done");
    expect(notified).not.toHaveBeenCalled();
  });

  it("lists review videos with their owner and space", async () => {
    await video("failed");
    const rows = await admin.listAdminVideos();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "review", status: "failed", spaceName: "Adm space", ownerEmail: `${ids.user}@example.test`, error: "boom" });
  });
});
