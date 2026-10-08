import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("home page data (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let home: typeof import("../queries");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `home${Date.now()}`;
  const owner = `${tag}-owner`;
  const stranger = `${tag}-stranger`;
  const empty = `${tag}-empty`;
  const spaceIds: string[] = [];
  // Fixed "now" so the 7-day buckets are exact: 2026-10-08 12:00 UTC, this week starts 2026-10-02
  const now = new Date("2026-10-08T12:00:00Z");
  const at = (iso: string) => new Date(iso);
  let videoId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    home = await import("../queries");

    await db.insert(s.user).values([owner, stranger, empty].map((id) => ({ id, name: `User ${id}`, email: `${id}@example.test` })));
    const [mine] = await db.insert(s.spaces).values({ name: `${tag} mine`, ownerId: owner, embedKey: `${tag}-mine` }).returning();
    const [theirs] = await db.insert(s.spaces).values({ name: `${tag} theirs`, ownerId: stranger, embedKey: `${tag}-theirs` }).returning();
    spaceIds.push(mine.id, theirs.id);

    const [video] = await db.insert(s.testimonials).values({ spaceId: mine.id, platform: "mp4", videoUrl: "https://cdn.test/v.mp4", customerName: "Sarah Chen", quote: "Doubled our demos" }).returning();
    const [other] = await db.insert(s.testimonials).values({ spaceId: mine.id, platform: "mp4", videoUrl: "https://cdn.test/w.mp4", customerName: "Ben" }).returning();
    const [theirVideo] = await db.insert(s.testimonials).values({ spaceId: theirs.id, platform: "mp4", videoUrl: "https://cdn.test/x.mp4" }).returning();
    videoId = video.id;

    const ev = (spaceId: string, eventType: "impression" | "play" | "convert", ts: string, testimonialId: string | null = null, sessionId = "x") =>
      ({ spaceId, eventType, timestamp: at(ts), testimonialId, sessionId });
    await db.insert(s.events).values([
      // This week: 4 impressions, Sarah played 3 times (2 sessions), Ben once; session a converts after playing
      ev(mine.id, "impression", "2026-10-03T10:00:00Z"),
      ev(mine.id, "impression", "2026-10-03T11:00:00Z"),
      ev(mine.id, "impression", "2026-10-05T10:00:00Z"),
      ev(mine.id, "impression", "2026-10-08T09:00:00Z"),
      ev(mine.id, "play", "2026-10-03T10:01:00Z", video.id, "a"),
      ev(mine.id, "play", "2026-10-04T10:01:00Z", video.id, "a"),
      ev(mine.id, "play", "2026-10-05T10:01:00Z", video.id, "b"),
      ev(mine.id, "play", "2026-10-05T10:02:00Z", other.id, "c"),
      ev(mine.id, "convert", "2026-10-03T10:05:00Z", null, "a"),
      // Session c converted before it played anything: not counted for anyone
      ev(mine.id, "convert", "2026-10-05T09:00:00Z", null, "c"),
      // The week before: 2 impressions
      ev(mine.id, "impression", "2026-09-28T10:00:00Z"),
      ev(mine.id, "impression", "2026-09-30T10:00:00Z"),
      // Someone else's space: never counted
      ev(theirs.id, "impression", "2026-10-03T10:00:00Z"),
      ev(theirs.id, "play", "2026-10-03T10:00:00Z", theirVideo.id, "z"),
      ev(theirs.id, "play", "2026-10-03T10:00:00Z", theirVideo.id, "z"),
      ev(theirs.id, "play", "2026-10-03T10:00:00Z", theirVideo.id, "z"),
      ev(theirs.id, "play", "2026-10-03T10:00:00Z", theirVideo.id, "z"),
    ]);

    const [form] = await db.insert(s.collectionForms).values({ spaceId: mine.id, title: "Tell us", promptText: "How was it?", slug: `${tag}-form` }).returning();
    await db.insert(s.submissions).values([
      { formId: form.id, type: "text", text: "Great", customerName: "P", customerEmail: "p@example.test" },
      { formId: form.id, type: "video", customerName: "Q", customerEmail: "q@example.test", processingStatus: "failed" },
      { formId: form.id, type: "text", text: "Old", customerName: "R", customerEmail: "r@example.test", status: "approved" },
    ]);
  });

  afterAll(async () => {
    if (db && spaceIds.length) {
      await db.delete(s.spaces).where(inArray(s.spaces.id, spaceIds));
      await db.delete(s.user).where(inArray(s.user.id, [owner, stranger, empty]));
    }
    await releaseLock?.();
  });

  it("is null for someone with no spaces (the page sends them to onboarding)", async () => {
    expect(await home.getHomeData(empty, 7, now)).toBeNull();
  });

  it("counts this week against the week before, for the owner's spaces only", async () => {
    const data = (await home.getHomeData(owner, 7, now))!;
    expect(data.pulse.impressions).toMatchObject({ current: 4, previous: 2 });
    expect(data.pulse.impressions.series).toHaveLength(7);
    expect(data.pulse.impressions.series[1]).toBe(2); // 2026-10-03
    expect(data.pulse.plays.current).toBe(4);
    expect(data.pulse.conversions.current).toBe(2);
    expect(data.spaces.map((x) => x.name)).toEqual([`${tag} mine`]);
    expect(data.spaces[0]).toMatchObject({ testimonialCount: 2, plays: 4 });
  });

  it("spotlights the most played video, counting only viewers who converted after playing it", async () => {
    const data = (await home.getHomeData(owner, 7, now))!;
    expect(data.spotlight?.testimonial.id).toBe(videoId);
    expect(data.spotlight?.plays).toBe(3);
    expect(data.spotlight?.convertingViewers).toBe(1);
  });

  it("lists pending submissions and failed uploads, and ticks the setup steps that are done", async () => {
    const data = (await home.getHomeData(owner, 7, now))!;
    expect(data.needs.pending).toEqual([{ spaceId: spaceIds[0], spaceName: `${tag} mine`, count: 2 }]);
    expect(data.needs.failedUploads).toBe(1);
    const done = Object.fromEntries(data.checklist.map((c) => [c.key, c.done]));
    expect(done).toEqual({ space: true, testimonial: true, widget: false, install: true, collect: true });
  });
});
