import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("notification inbox (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let q: typeof import("../queries");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `inb${Date.now()}`;
  const me = `${tag}-me`;
  const other = `${tag}-other`;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    q = await import("../queries");
    await db.insert(s.user).values([
      { id: me, name: "Me", email: `${me}@example.test` },
      { id: other, name: "Other", email: `${other}@example.test` },
    ]);
    // 45 for me (every third one read), 3 for someone else. Newer ones have later times.
    const rows = Array.from({ length: 45 }, (_, i) => ({
      userId: me,
      type: "submission.received",
      title: `Item ${i}`,
      readAt: i % 3 === 0 ? new Date() : null,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
    }));
    await db.insert(s.notifications).values(rows as never);
    await db.insert(s.notifications).values([0, 1, 2].map((i) => ({ userId: other, type: "submission.received", title: `Theirs ${i}` })) as never);
  }, 60_000);

  afterAll(async () => {
    await db.delete(s.user).where(eq(s.user.id, me));
    await db.delete(s.user).where(eq(s.user.id, other));
    await releaseLock?.();
  });

  it("pages newest first, 20 at a time, and only the person's own", async () => {
    const first = await q.listInbox(me, { page: 1 });
    expect(first).toMatchObject({ total: 45, page: 1, pages: 3 });
    expect(first.items).toHaveLength(20);
    expect(first.items[0].title).toBe("Item 44");
    const third = await q.listInbox(me, { page: 3 });
    expect(third.items).toHaveLength(5);
    expect(third.items.at(-1)?.title).toBe("Item 0");
    expect(JSON.stringify([first, third])).not.toContain("Theirs");
  });

  it("shows only unread when asked, with the unread count either way", async () => {
    const unread = await q.listInbox(me, { unreadOnly: true });
    expect(unread.total).toBe(30);
    expect(unread.items.every((i) => i.readAt === null)).toBe(true);
    expect(unread.unreadCount).toBe(30);
    expect((await q.listInbox(me)).unreadCount).toBe(30);
  });

  it("shows the last page for a page past the end, and the first for nonsense", async () => {
    expect((await q.listInbox(me, { page: 99 })).page).toBe(3);
    expect((await q.listInbox(me, { page: -4 })).page).toBe(1);
    expect((await q.listInbox(me, { page: Number.NaN })).page).toBe(1);
  });

  it("marks everything read for the person, and only theirs", async () => {
    await q.markNotificationsRead(me);
    expect((await q.listInbox(me, { unreadOnly: true })).total).toBe(0);
    expect((await q.listInbox(other, { unreadOnly: true })).total).toBe(3);
  });

  it("an empty inbox is one empty page", async () => {
    const id = `${tag}-empty`;
    await db.insert(s.user).values({ id, name: "E", email: `${id}@example.test` });
    expect(await q.listInbox(id)).toMatchObject({ items: [], total: 0, page: 1, pages: 1 });
    await db.delete(s.user).where(eq(s.user.id, id));
  });
});
