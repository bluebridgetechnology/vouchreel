import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Real Postgres, real route handler. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

let sessionUserId = "";
vi.mock("@/lib/auth/session", () => ({ getSession: async () => (sessionUserId ? { user: { id: sessionUserId } } : null) }));
vi.mock("@/lib/webhooks/dispatch", () => ({ dispatchWebhookEvent: vi.fn(() => Promise.resolve()) }));

run("the dashboard's delete testimonial removes it for good (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let route: typeof import("../route");
  let cleanup: typeof import("@/lib/storage/cleanup");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `dt${Date.now()}`;
  const owner = `${tag}-owner`;
  const stranger = `${tag}-stranger`;
  const cdn = "https://cdn.test";
  const spaceIds: string[] = [];

  const del = (spaceId: string, tid: string) =>
    route.DELETE(new Request("http://x", { method: "DELETE" }), { params: Promise.resolve({ id: spaceId, tid }) });
  const queuedKeys = async () =>
    (await db.select().from(s.jobs).where(eq(s.jobs.type, cleanup.FILE_CLEANUP_JOB))).flatMap((r) => (r.payload.keys as string[]) ?? []).sort();

  async function seed(name: string) {
    const [space] = await db.insert(s.spaces).values({ name: `${tag} ${name}`, ownerId: owner, embedKey: `${tag}-${name}` }).returning();
    spaceIds.push(space.id);
    const [t] = await db
      .insert(s.testimonials)
      .values({ spaceId: space.id, platform: "mp4", videoUrl: `${cdn}/submissions/${name}/t.mp4`, thumbnailUrl: `${cdn}/submissions/${name}/t.jpg` })
      .returning();
    await db.insert(s.socialExports).values({ spaceId: space.id, testimonialId: t.id, format: "tiktok", status: "done", outputUrl: `${cdn}/social-exports/${name}/e.mp4` });
    return { space, t };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    route = await import("../route");
    cleanup = await import("@/lib/storage/cleanup");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values([
      { id: owner, name: "Owner", email: `${owner}@example.test` },
      { id: stranger, name: "Stranger", email: `${stranger}@example.test` },
    ]);
    await db.delete(s.jobs);
  }, 600_000);

  afterAll(async () => {
    await db.delete(s.jobs);
    await db.delete(s.spaces).where(inArray(s.spaces.id, spaceIds));
    await db.delete(s.user).where(inArray(s.user.id, [owner, stranger]));
    await pool?.end();
    await releaseLock?.();
  });

  it("deletes the row and queues its video, thumbnail and social export files", async () => {
    const { space, t } = await seed("a");
    sessionUserId = owner;
    const res = await del(space.id, t.id);
    expect(res.status).toBe(200);
    expect(await db.select().from(s.testimonials).where(eq(s.testimonials.id, t.id))).toHaveLength(0);
    expect(await queuedKeys()).toEqual(["social-exports/a/e.mp4", "submissions/a/t.jpg", "submissions/a/t.mp4"]);
  });

  it("a second delete says it is gone, and queues nothing more", async () => {
    const { space, t } = await seed("b");
    sessionUserId = owner;
    await db.delete(s.jobs);
    expect((await del(space.id, t.id)).status).toBe(200);
    const before = await queuedKeys();
    expect((await del(space.id, t.id)).status).toBe(404);
    expect(await queuedKeys()).toEqual(before);
  });

  it("someone with no access to the space cannot delete, and nothing changes", async () => {
    const { space, t } = await seed("c");
    sessionUserId = stranger;
    await db.delete(s.jobs);
    expect((await del(space.id, t.id)).status).toBeGreaterThanOrEqual(403);
    expect(await db.select().from(s.testimonials).where(eq(s.testimonials.id, t.id))).toHaveLength(1);
    expect(await queuedKeys()).toEqual([]);
  });

  it("signed out is refused", async () => {
    const { space, t } = await seed("d");
    sessionUserId = "";
    expect((await del(space.id, t.id)).status).toBe(401);
  });
});
