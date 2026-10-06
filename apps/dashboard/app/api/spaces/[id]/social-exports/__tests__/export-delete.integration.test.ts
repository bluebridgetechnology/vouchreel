import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

let sessionUser: string | null = null;
vi.mock("@/lib/auth/session", () => ({ getSession: async () => (sessionUser ? { user: { id: sessionUser } } : null) }));

run("DELETE /api/spaces/:id/social-exports/:exportId (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let route: typeof import("../[exportId]/route");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `exp${Date.now()}`;
  const owner = `${tag}-owner`;
  const stranger = `${tag}-stranger`;
  let spaceId = "";
  let testimonialId = "";

  const call = (exportId: string, sid = spaceId) =>
    route.DELETE(new Request("http://x", { method: "DELETE" }), { params: Promise.resolve({ id: sid, exportId }) });
  const makeExport = async (status: "pending" | "processing" | "done" | "failed", outputUrl: string | null) =>
    (await db.insert(s.socialExports).values({ spaceId, testimonialId, format: "tiktok", status, outputUrl }).returning())[0];
  const queuedKeys = async () =>
    (await db.select().from(s.jobs).where(eq(s.jobs.type, "file_cleanup"))).flatMap((j) => j.payload.keys as string[]);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    route = await import("../[exportId]/route");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values([
      { id: owner, name: "O", email: `${owner}@example.test` },
      { id: stranger, name: "S", email: `${stranger}@example.test` },
    ]);
    const [space] = await db.insert(s.spaces).values({ name: tag, ownerId: owner, embedKey: tag }).returning();
    spaceId = space.id;
    testimonialId = (await db.insert(s.testimonials).values({ spaceId, platform: "mp4", videoUrl: "https://cdn.test/submissions/x/v.mp4" }).returning())[0].id;
  }, 600_000);

  beforeEach(async () => {
    sessionUser = owner;
    await db.delete(s.jobs);
    await db.delete(s.socialExports).where(eq(s.socialExports.spaceId, spaceId));
  });

  afterAll(async () => {
    await db.delete(s.jobs);
    await db.delete(s.spaces).where(eq(s.spaces.id, spaceId));
    await db.delete(s.user).where(inArray(s.user.id, [owner, stranger]));
    await pool?.end();
    await releaseLock?.();
  });

  it("deletes a finished export and queues its file for deletion", async () => {
    const e = await makeExport("done", "https://cdn.test/social-exports/sp/t/tiktok-abc.mp4");
    const res = await call(e.id);
    expect(res.status).toBe(200);
    expect(await db.select().from(s.socialExports).where(eq(s.socialExports.id, e.id))).toHaveLength(0);
    expect(await queuedKeys()).toEqual(["social-exports/sp/t/tiktok-abc.mp4"]);
  });

  it("deletes a failed export that never produced a file, and queues nothing", async () => {
    const e = await makeExport("failed", null);
    expect((await call(e.id)).status).toBe(200);
    expect(await queuedKeys()).toEqual([]);
  });

  it("refuses an export that is still being made, and leaves it", async () => {
    for (const status of ["pending", "processing"] as const) {
      const e = await makeExport(status, null);
      expect((await call(e.id)).status).toBe(400);
      expect(await db.select().from(s.socialExports).where(eq(s.socialExports.id, e.id))).toHaveLength(1);
    }
    expect(await queuedKeys()).toEqual([]);
  });

  it("only the space's owner can delete, and an unknown export is a 404", async () => {
    const e = await makeExport("done", "https://cdn.test/social-exports/sp/t/x.mp4");
    sessionUser = null;
    expect((await call(e.id)).status).toBe(401);
    sessionUser = stranger;
    expect((await call(e.id)).status).toBe(403);
    expect(await db.select().from(s.socialExports).where(eq(s.socialExports.id, e.id))).toHaveLength(1);
    sessionUser = owner;
    expect((await call("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await call(e.id, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect(await queuedKeys()).toEqual([]);
  });
});
