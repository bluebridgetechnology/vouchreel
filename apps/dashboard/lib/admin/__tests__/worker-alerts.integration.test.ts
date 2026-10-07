import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set. Emails are captured, not sent. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string }[], fail: false }));
vi.mock("@/lib/email/transport", () => ({
  sendEmail: async (m: { to: string; subject: string }) => {
    if (mail.fail) return { sent: false, provider: "resend", error: "down" };
    mail.sent.push({ to: m.to, subject: m.subject });
    return { sent: true, provider: "resend" };
  },
}));

run("worker alerts and controls (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let like: typeof import("drizzle-orm").like;
  let s: typeof import("@/lib/db/schema");
  let alerts: typeof import("../worker-alerts");
  let control: typeof import("../worker-control");
  let health: typeof import("../workers");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `wa${Date.now()}`;
  const admin = `${tag}-admin`;
  const suspendedAdmin = `${tag}-susp`;
  const t0 = new Date();
  const base = { concurrency: 1, jobsProcessed: 0, capabilities: {}, startedAt: new Date(t0.getTime() - 3600_000) };

  async function clean() {
    await db.delete(s.jobs).where(like(s.jobs.type, "review_video"));
    await db.delete(s.workerHeartbeats);
    await db.delete(s.adminAlertState);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, like } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    alerts = await import("../worker-alerts");
    control = await import("../worker-control");
    health = await import("../workers");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values([
      { id: admin, name: "A", email: `${admin}@example.test`, isPlatformAdmin: true },
      { id: suspendedAdmin, name: "S", email: `${suspendedAdmin}@example.test`, isPlatformAdmin: true, suspendedAt: new Date() },
    ]);
  }, 600_000);

  beforeEach(async () => {
    mail.sent.length = 0;
    mail.fail = false;
    await clean();
  });

  afterAll(async () => {
    await clean();
    await db.delete(s.user).where(eq(s.user.id, admin));
    await db.delete(s.user).where(eq(s.user.id, suspendedAdmin));
    await pool?.end();
    await releaseLock?.();
  });

  const mine = () => mail.sent.filter((m) => m.to.startsWith(tag));
  const queueVideo = () => db.insert(s.jobs).values({ type: "review_video", payload: {}, status: "queued", runAt: new Date(t0.getTime() - 60_000) });

  it("emails the platform admins once when video renders have no worker, and not a suspended admin", async () => {
    await queueVideo();
    const first = await alerts.runWorkerAlerts(t0);
    expect(first.sent).toEqual([{ key: "worker:video-worker", action: "problem", to: expect.any(Number) }]);
    // Other admins may exist in a shared database; this test's own admin is told, its suspended one is not
    expect(mine().map((m) => m.to)).toEqual([`${admin}@example.test`]);
    expect(mine()[0].subject).toBe("Video worker needs attention");
    // Five minutes later: same problem, no second email
    const second = await alerts.runWorkerAlerts(new Date(t0.getTime() + 5 * 60_000));
    expect(second.sent).toEqual([]);
    expect(mine()).toHaveLength(1);
  });

  it("emails again when a lasting problem passes the reminder interval, and once more when it is fixed", async () => {
    await queueVideo();
    await alerts.runWorkerAlerts(t0);
    await alerts.runWorkerAlerts(new Date(t0.getTime() + 6 * 3600_000 + 1000));
    expect(mine().map((m) => m.subject)).toEqual(["Video worker needs attention", "Video worker needs attention"]);

    // A video worker comes online and the queue clears
    const later = new Date(t0.getTime() + 7 * 3600_000);
    await db.delete(s.jobs).where(like(s.jobs.type, "review_video"));
    await db.insert(s.workerHeartbeats).values({ ...base, workerId: `${tag}-vw`, kind: "video-worker", lastSeenAt: later, capabilities: { chromium: "ok" } });
    await alerts.runWorkerAlerts(later);
    expect(mine().at(-1)?.subject).toBe("Video worker is back");
    expect(mine()).toHaveLength(3);
    await alerts.runWorkerAlerts(new Date(later.getTime() + 5 * 60_000));
    expect(mine()).toHaveLength(3);
  });

  it("sends nothing for a deployment that never ran a video worker and has nothing waiting", async () => {
    expect((await alerts.runWorkerAlerts(t0)).sent).toEqual([]);
    expect(mail.sent).toEqual([]);
  });

  it("tries again next time when the email could not be delivered", async () => {
    await queueVideo();
    mail.fail = true;
    expect((await alerts.runWorkerAlerts(t0)).sent).toEqual([]);
    mail.fail = false;
    expect((await alerts.runWorkerAlerts(new Date(t0.getTime() + 5 * 60_000))).sent).toHaveLength(1);
  });

  it("shows what each worker is running now", async () => {
    await db.insert(s.workerHeartbeats).values({ ...base, workerId: `${tag}-w`, kind: "worker", lastSeenAt: t0 });
    await db.insert(s.jobs).values({ type: "file_cleanup", payload: {}, status: "running", lockedBy: `${tag}-w`, lockedAt: t0 });
    const worker = (await health.getWorkerHealth(t0)).workers.find((w) => w.workerId === `${tag}-w`)!;
    expect(worker.currentJobs.map((j) => j.type)).toEqual(["file_cleanup"]);
    await db.delete(s.jobs).where(eq(s.jobs.lockedBy, `${tag}-w`));
  });

  it("restart: sets the request for a running worker, refuses a stopped or unknown one", async () => {
    await db.insert(s.workerHeartbeats).values([
      { ...base, workerId: `${tag}-up`, kind: "worker", lastSeenAt: new Date() },
      { ...base, workerId: `${tag}-down`, kind: "worker", lastSeenAt: new Date(), stoppedAt: new Date() },
    ]);
    expect(await control.requestWorkerRestart(`${tag}-up`)).toMatchObject({ ok: true, kind: "worker" });
    const [row] = await db.select().from(s.workerHeartbeats).where(eq(s.workerHeartbeats.workerId, `${tag}-up`));
    expect(row.restartRequestedAt).toBeInstanceOf(Date);
    expect(await control.requestWorkerRestart(`${tag}-down`)).toMatchObject({ ok: false, reason: "not_running" });
    expect(await control.requestWorkerRestart("nope")).toMatchObject({ ok: false, reason: "not_found" });
    const [untouched] = await db.select().from(s.workerHeartbeats).where(eq(s.workerHeartbeats.workerId, `${tag}-down`));
    expect(untouched.restartRequestedAt).toBeNull();
  });
});
