import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const session = vi.hoisted(() => ({ userId: "" }));

vi.mock("@/lib/ai-video/access", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireSpaceOwner: vi.fn(async (spaceId: string) => {
      const { db } = await import("@/lib/db");
      const { spaces } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      const [row] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
      if (!row || row.ownerId !== session.userId) return { response: NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 }) };
      return { userId: session.userId, ownerId: row.ownerId };
    }),
  };
});

run("widget performance (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let perf: typeof import("../performance");
  let route: typeof import("@/app/api/spaces/[id]/widgets/[widgetId]/performance/route");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `pf${Date.now()}`;
  const owner = `${tag}-owner`;
  const now = new Date("2026-10-09T15:00:00Z");
  let space = "";
  let other = "";
  let hero = "";
  let wall = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    perf = await import("../performance");
    route = await import("@/app/api/spaces/[id]/widgets/[widgetId]/performance/route");

    await db.insert(s.user).values({ id: owner, name: owner, email: `${owner}@example.test` });
    const mk = async (n: string) => (await db.insert(s.spaces).values({ name: `${tag} ${n}`, ownerId: owner, embedKey: `${tag}-${n}` }).returning())[0].id;
    space = await mk("a");
    other = await mk("b");
    hero = (await db.insert(s.widgetConfigs).values({ spaceId: space, name: "Hero", sortOrder: 0 }).returning())[0].id;
    wall = (await db.insert(s.widgetConfigs).values({ spaceId: space, name: "Wall", sortOrder: 1 }).returning())[0].id;

    const ev = (widgetId: string | null, eventType: "impression" | "play" | "click" | "convert", ts: string, spaceId = space) => ({
      spaceId, widgetId, eventType, timestamp: new Date(ts), sessionId: "s",
    });
    await db.insert(s.events).values([
      // Today and recent days (inside the 30-day window ending 2026-10-09)
      ev(hero, "impression", "2026-10-09T01:00:00Z"),
      ev(hero, "impression", "2026-10-09T14:59:00Z"),
      ev(hero, "play", "2026-10-09T14:59:30Z"),
      ev(hero, "click", "2026-10-09T14:59:40Z"),
      ev(hero, "impression", "2026-10-08T23:59:59Z"), // a late evening UTC still counts on its own day
      ev(hero, "impression", "2026-09-10T00:00:00Z"), // the first moment of the window (30 days: Sep 10 to Oct 9)
      // The 30 days before
      ev(hero, "impression", "2026-09-09T23:59:59Z"),
      ev(hero, "impression", "2026-08-11T00:00:00Z"),
      ev(hero, "play", "2026-08-11T00:00:01Z"),
      // Too old, in the future, the wrong widget, the wrong kind, the wrong space
      ev(hero, "impression", "2026-08-10T23:59:59Z"),
      ev(wall, "impression", "2026-10-09T10:00:00Z"),
      ev(null, "impression", "2026-10-09T10:00:00Z"),
      ev(hero, "convert", "2026-10-09T10:00:00Z"),
      ev(hero, "impression", "2026-10-09T10:00:00Z", other),
    ]);
    session.userId = owner;
  }, 600_000);

  afterAll(async () => {
    if (db) {
      await db.delete(s.spaces).where(inArray(s.spaces.id, [space, other]));
      await db.delete(s.user).where(eq(s.user.id, owner));
    }
    await releaseLock?.();
  }, 60_000);

  it("counts the last 30 whole UTC days and the 30 before, for this widget's views, plays and clicks only", async () => {
    const p = await perf.getWidgetPerformance(space, hero, 30, now);
    expect(p).toMatchObject({ days: 30, views: 4, plays: 1, clicks: 1, previous: { views: 2, plays: 1, clicks: 0 } });
  });

  it("gives one point per day, oldest first, zeros included, and the days add up to the totals", async () => {
    const p = await perf.getWidgetPerformance(space, hero, 30, now);
    expect(p.series).toHaveLength(30);
    expect(p.series[0]).toEqual({ date: "2026-09-10", views: 1, plays: 0 });
    expect(p.series[29]).toEqual({ date: "2026-10-09", views: 2, plays: 1 });
    expect(p.series.find((d) => d.date === "2026-10-08")).toEqual({ date: "2026-10-08", views: 1, plays: 0 });
    expect(p.series.find((d) => d.date === "2026-09-20")).toEqual({ date: "2026-09-20", views: 0, plays: 0 });
    expect(p.series.reduce((n, d) => n + d.views, 0)).toBe(p.views);
  });

  it("a widget with no events, or another space's widget, is all zeros", async () => {
    const p = await perf.getWidgetPerformance(other, wall, 30, now);
    expect(p).toMatchObject({ views: 0, plays: 0, clicks: 0, previous: { views: 0, plays: 0, clicks: 0 } });
    expect(p.series.every((d) => d.views === 0)).toBe(true);
  });

  it("the route returns it with when the widget was published, for its owner only", async () => {
    const call = (widgetId: string) => route.GET(new Request("http://x"), { params: Promise.resolve({ id: space, widgetId }) });
    const res = await call(hero);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ days: 30, publishedAt: null, isLive: true, series: expect.any(Array) });
    expect((await call("00000000-0000-4000-8000-00000000dead")).status).toBe(404);
    session.userId = "someone-else";
    expect((await call(hero)).status).toBe(403);
    session.userId = owner;
  });
});
