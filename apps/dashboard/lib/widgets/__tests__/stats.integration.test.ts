import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ success: true, remaining: 99, reset: Date.now() + 60_000 })) }));
vi.mock("@/lib/webhooks/dispatch", () => ({ dispatchWebhookEvent: vi.fn(() => Promise.resolve()) }));

run("events that name a widget (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let stats: typeof import("../stats");
  let queries: typeof import("@/lib/analytics/queries");
  let eventsRoute: typeof import("@/app/api/events/route");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `ws${Date.now()}`;
  const owner = `${tag}-owner`;
  const spaceIds: string[] = [];
  const now = new Date("2026-10-09T12:00:00Z");
  const at = (iso: string) => new Date(iso);
  let space = "";
  let other = "";
  let hero = "";
  let wall = "";
  let foreign = "";

  const post = (events: Record<string, unknown>[]) =>
    eventsRoute.POST(new Request("http://x/api/events", { method: "POST", body: JSON.stringify({ events }) }));

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    stats = await import("../stats");
    queries = await import("@/lib/analytics/queries");
    eventsRoute = await import("@/app/api/events/route");

    await db.insert(s.user).values({ id: owner, name: owner, email: `${owner}@example.test` });
    const mk = async (n: string) => (await db.insert(s.spaces).values({ name: `${tag} ${n}`, ownerId: owner, embedKey: `${tag}-${n}` }).returning())[0].id;
    space = await mk("one");
    other = await mk("two");
    spaceIds.push(space, other);
    const widget = async (spaceId: string, name: string, sortOrder: number) => (await db.insert(s.widgetConfigs).values({ spaceId, name, sortOrder }).returning())[0].id;
    hero = await widget(space, "Hero", 0);
    wall = await widget(space, "Wall", 1);
    foreign = await widget(other, "Other space's", 0);
  }, 600_000);

  afterAll(async () => {
    if (db) {
      if (spaceIds.length) await db.delete(s.spaces).where(inArray(s.spaces.id, spaceIds)); // widgets and events go with them
      await db.delete(s.user).where(eq(s.user.id, owner));
    }
    await releaseLock?.();
  }, 60_000);

  it("the endpoint stores the id of a widget of the event's space, and drops one that is not (deleted, made up, another space's)", async () => {
    const gone = "00000000-0000-4000-8000-00000000dead";
    const res = await post([
      { spaceId: space, widgetId: hero, sessionId: "a", eventType: "impression", timestamp: "2026-10-08T10:00:00Z" },
      { spaceId: space, widgetId: foreign, sessionId: "a", eventType: "impression", timestamp: "2026-10-08T10:00:01Z" },
      { spaceId: space, widgetId: gone, sessionId: "a", eventType: "impression", timestamp: "2026-10-08T10:00:02Z" },
      { spaceId: space, sessionId: "a", eventType: "convert", timestamp: "2026-10-08T10:00:03Z" },
    ]);
    expect(res.status).toBe(201);
    const rows = await db.select().from(s.events).where(eq(s.events.spaceId, space));
    const byTime = rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    expect(byTime.map((r) => r.widgetId)).toEqual([hero, null, null, null]); // the rest still count for the space
    await db.delete(s.events).where(eq(s.events.spaceId, space));
  });

  describe("the numbers on a widget's card", () => {
    beforeAll(async () => {
      const ev = (widgetId: string | null, eventType: "impression" | "play" | "convert", ts: string) => ({ spaceId: space, widgetId, eventType, timestamp: at(ts), sessionId: "s" });
      await db.insert(s.events).values([
        ev(hero, "impression", "2026-10-08T10:00:00Z"),
        ev(hero, "impression", "2026-10-01T10:00:00Z"),
        ev(hero, "impression", "2026-09-20T10:00:00Z"), // exactly 19 days: inside 30
        ev(hero, "play", "2026-10-02T10:00:00Z"),
        ev(hero, "impression", "2026-08-01T10:00:00Z"), // older than 30 days: not counted
        ev(wall, "impression", "2026-10-07T10:00:00Z"),
        ev(null, "impression", "2026-10-07T10:00:00Z"), // from before widgets were told apart
        ev(null, "convert", "2026-10-07T10:00:00Z"), // a conversion belongs to the page
        { spaceId: other, widgetId: foreign, eventType: "impression" as const, timestamp: at("2026-10-07T10:00:00Z"), sessionId: "s" },
      ]);
    });

    it("counts each widget's views and plays over the last 30 days, and only those events", async () => {
      const result = await stats.getWidgetStats(space, 30, now);
      expect(Object.fromEntries(result)).toEqual({ [hero]: { views: 3, plays: 1 }, [wall]: { views: 1, plays: 0 } });
    });

    it("leaves out widgets with no events, other spaces' widgets, and respects the window", async () => {
      expect((await stats.getWidgetStats(space, 30, now)).has(foreign)).toBe(false);
      expect(Object.fromEntries(await stats.getWidgetStats(space, 3, now))).toEqual({ [hero]: { views: 1, plays: 0 }, [wall]: { views: 1, plays: 0 } });
      expect((await stats.getWidgetStats(other, 30, now)).get(foreign)).toEqual({ views: 1, plays: 0 });
      expect((await stats.getWidgetStats("00000000-0000-4000-8000-000000000000", 30, now)).size).toBe(0);
    });

    it("the Analytics page can show one widget: its overview counts only that widget's events", async () => {
      const range = { start: at("2026-09-01T00:00:00Z"), end: at("2026-10-09T23:59:59Z") };
      expect(await queries.getOverviewStats(space, range, { widgetId: hero })).toMatchObject({ impressions: 3, plays: 1, conversions: 0 });
      expect(await queries.getOverviewStats(space, range, { widgetId: wall })).toMatchObject({ impressions: 1, plays: 0 });
      // Without the filter it is the whole space, tagged or not
      expect(await queries.getOverviewStats(space, range)).toMatchObject({ impressions: 5, plays: 1, conversions: 1 });
    });

    it("offers the space's widgets, in order, as the filter's choices", async () => {
      const options = await queries.getFilterOptions(space, { start: at("2026-09-01T00:00:00Z"), end: at("2026-10-09T23:59:59Z") });
      expect(options.widgets).toEqual([{ id: hero, name: "Hero" }, { id: wall, name: "Wall" }]);
    });

    it("deleting a widget keeps its events: they stay in the space's numbers, just no longer tied to a widget", async () => {
      const range = { start: at("2026-09-01T00:00:00Z"), end: at("2026-10-09T23:59:59Z") };
      const before = (await queries.getOverviewStats(space, range)).impressions;
      await db.delete(s.widgetConfigs).where(eq(s.widgetConfigs.id, wall));
      expect((await queries.getOverviewStats(space, range)).impressions).toBe(before);
      expect((await stats.getWidgetStats(space, 30, now)).has(wall)).toBe(false);
      const [row] = await db.select().from(s.events).where(eq(s.events.timestamp, at("2026-10-07T10:00:00Z")));
      expect(row.widgetId).toBeNull();
    });
  });
});
