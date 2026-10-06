import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("admin audit log queries (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let q: typeof import("../queries");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `aud${Date.now()}`;
  const actor = `${tag}-actor`;
  const day = (d: string) => new Date(`${d}T12:00:00.000Z`);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    q = await import("../queries");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;

    await db.delete(s.adminAuditLog);
    await db.insert(s.user).values({ id: actor, name: "Aud", email: `${tag}@example.test` });
    const rows = [
      { action: "plan.updated", entityType: "plan", summary: "Updated plan Pro (price)", createdAt: day("2026-09-01") },
      { action: "plan.created", entityType: "plan", summary: "Created plan 100% Free_Tier", createdAt: day("2026-09-02") },
      { action: "user.updated", entityType: "user", summary: "Granted admin for bob@example.test", createdAt: day("2026-09-03") },
      { action: "job.retry", entityType: "job", summary: "Retried review_video job", createdAt: day("2026-09-04") },
      { action: "job.cancel", entityType: "job", summary: "Cancelled review_video job", createdAt: day("2026-09-05") },
    ];
    await db.insert(s.adminAuditLog).values(rows.map((r) => ({ ...r, actorId: actor, changes: { x: { from: 1, to: 2 } } })));
    // An entry whose actor was deleted
    await db.insert(s.adminAuditLog).values({ action: "settings.payment_provider", entityType: "setting", summary: "Switched provider", actorId: null, createdAt: day("2026-09-06") });
  }, 600_000);

  afterAll(async () => {
    await db.delete(s.adminAuditLog);
    await db.delete(s.user).where(eq(s.user.id, actor));
    await pool?.end();
    await releaseLock?.();
  });

  it("returns newest first with the actor, entity and changes", async () => {
    const page = await q.listAuditLog();
    expect(page.total).toBe(6);
    expect(page.rows.map((r) => r.action)).toEqual(["settings.payment_provider", "job.cancel", "job.retry", "user.updated", "plan.created", "plan.updated"]);
    expect(page.rows[0].actorEmail).toBeNull();
    expect(page.rows[1]).toMatchObject({ actorEmail: `${tag}@example.test`, changes: { x: { from: 1, to: 2 } } });
  });

  it("pages without overlap or gaps", async () => {
    const p1 = await q.listAuditLog({}, 1, 4);
    const p2 = await q.listAuditLog({}, 2, 4);
    const p3 = await q.listAuditLog({}, 3, 4);
    expect([p1.rows.length, p2.rows.length, p3.rows.length]).toEqual([4, 2, 0]);
    expect(new Set([...p1.rows, ...p2.rows].map((r) => r.id)).size).toBe(6);
    expect(p3.total).toBe(6);
    // Bad page numbers fall back to the first page
    for (const bad of [0, -3, Number.NaN, 1.9]) expect((await q.listAuditLog({}, bad, 4)).page).toBe(1);
  });

  it("filters by entity type", async () => {
    const jobs = await q.listAuditLog({ entityType: "job" });
    expect(jobs.total).toBe(2);
    expect(jobs.rows.every((r) => r.entityType === "job")).toBe(true);
    expect((await q.listAuditLog({ entityType: "nothing" })).total).toBe(0);
  });

  it("searches summary, action and actor email, and treats wildcards literally", async () => {
    expect((await q.listAuditLog({ q: "BOB@" })).total).toBe(1);
    expect((await q.listAuditLog({ q: "job.retry" })).total).toBe(1);
    expect((await q.listAuditLog({ q: tag })).total).toBe(5); // actor email: every entry with an actor
    expect((await q.listAuditLog({ q: "100%" })).total).toBe(1);
    expect((await q.listAuditLog({ q: "%" })).total).toBe(1); // only the row that really contains a percent sign
    expect((await q.listAuditLog({ q: "Free_Tier" })).total).toBe(1);
    expect((await q.listAuditLog({ q: "Free-Tier" })).total).toBe(0);
    expect((await q.listAuditLog({ q: "  " })).total).toBe(6);
  });

  it("filters by inclusive UTC date range and ignores malformed dates", async () => {
    expect((await q.listAuditLog({ from: "2026-09-03", to: "2026-09-04" })).total).toBe(2);
    expect((await q.listAuditLog({ from: "2026-09-05" })).total).toBe(2);
    expect((await q.listAuditLog({ to: "2026-09-01" })).total).toBe(1);
    expect((await q.listAuditLog({ from: "not-a-date", to: "2026-02-31" })).total).toBe(6);
  });

  it("combines filters and lists entity types", async () => {
    expect((await q.listAuditLog({ entityType: "job", q: "cancel", from: "2026-09-01" })).total).toBe(1);
    expect(await q.listAuditEntityTypes()).toEqual(["job", "plan", "setting", "user"]);
  });
});
