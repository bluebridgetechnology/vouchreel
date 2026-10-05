import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Real Postgres (migrations applied). Skipped unless TEST_DATABASE_URL is set:
 *   TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard
 */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

vi.mock("@/lib/payments/subscription", () => ({
  getSubscriptionLimits: async () => ({ reviewVideoCredits: 5, aiVideoCredits: 0, removeWatermark: false }),
}));

run("brand kit (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let kitService: typeof import("../service");
  let reviewVideos: typeof import("@/lib/review-video/service");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const ids = { user: `bk-test-${Date.now()}`, space: "", review: "" };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    kitService = await import("../service");
    reviewVideos = await import("@/lib/review-video/service");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;

    await db.insert(s.user).values({ id: ids.user, name: "BK Test", email: `${ids.user}@example.test` });
    const [space] = await db.insert(s.spaces).values({ name: "BK", ownerId: ids.user, embedKey: ids.user }).returning();
    ids.space = space.id;
    const [review] = await db
      .insert(s.reviews)
      .values({ spaceId: space.id, provider: "google", providerReviewId: `${ids.user}-r`, authorName: "Maya", rating: 5, text: "Setup took ten minutes and support was great." })
      .returning();
    ids.review = review.id;
  }, 600_000);

  beforeEach(async () => {
    await db.delete(s.brandKits).where(eq(s.brandKits.spaceId, ids.space));
    await db.delete(s.widgetConfigs).where(eq(s.widgetConfigs.spaceId, ids.space));
    await db.delete(s.reviewVideos);
    await db.delete(s.jobs);
  });

  afterAll(async () => {
    await db.delete(s.reviewVideos);
    await db.delete(s.jobs);
    await db.delete(s.user).where(eq(s.user.id, ids.user)); // cascades the space, kit and reviews
    await pool?.end();
    await releaseLock?.();
  });

  const input = (over: Record<string, unknown> = {}) =>
    ({ primaryColor: "#112233", accentColor: null, borderRadius: null, fontMode: "inherit", fontFamily: null, inheritTextColor: false, ...over }) as Parameters<typeof kitService.saveBrandKit>[1];

  it("has no kit until one is saved, and suggests what the widget uses today", async () => {
    expect(await kitService.getBrandKit(ids.space)).toBeNull();

    await db.insert(s.widgetConfigs).values({ spaceId: ids.space, theme: { primaryColor: "#3b82f6", accentColor: "#000000", mode: "dark", borderRadius: 6 } });
    const suggested = await kitService.suggestedBrandValues(ids.space);
    expect(suggested).toMatchObject({ primaryColor: "#3b82f6", accentColor: "#000000", borderRadius: 6, fontMode: "inherit", inheritTextColor: false });
  });

  it("saves, then updates the same row (one kit per space)", async () => {
    const first = await kitService.saveBrandKit(ids.space, input());
    const second = await kitService.saveBrandKit(ids.space, input({ primaryColor: "#445566", borderRadius: 18, inheritTextColor: true }));

    expect(second.id).toBe(first.id);
    expect(await db.select().from(s.brandKits).where(eq(s.brandKits.spaceId, ids.space))).toHaveLength(1);
    expect(second).toMatchObject({ primaryColor: "#445566", borderRadius: 18, inheritTextColor: true });
    expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
  });

  it("keeps a custom font name only while the mode is custom", async () => {
    const custom = await kitService.saveBrandKit(ids.space, input({ fontMode: "custom", fontFamily: "Poppins" }));
    expect(custom.fontFamily).toBe("Poppins");

    const back = await kitService.saveBrandKit(ids.space, input({ fontMode: "inherit", fontFamily: "Poppins" }));
    expect(back.fontFamily).toBeNull();
  });

  it("round-trips through the widget theme the API sends", async () => {
    await kitService.saveBrandKit(ids.space, input({ accentColor: "#ffeecc", borderRadius: 0, fontMode: "custom", fontFamily: "Open Sans", inheritTextColor: true }));
    const kit = await kitService.getBrandKit(ids.space);
    const theme = kitService.applyBrandKitToTheme({ primaryColor: "#000000", accentColor: "#ffffff", mode: "dark", borderRadius: 12 }, kit ? kitService.toValues(kit) : null);

    expect(theme).toEqual({
      primaryColor: "#112233",
      accentColor: "#ffeecc",
      mode: "dark",
      borderRadius: 0, // zero is a real choice, not "unset"
      fontMode: "custom",
      fontFamily: "Open Sans",
      inheritTextColor: true,
    });
  });

  it("is the default brand colour for review videos, but an explicit colour still wins", async () => {
    await kitService.saveBrandKit(ids.space, input({ primaryColor: "#0a7d5a" }));

    const fromKit = await reviewVideos.createReviewVideo({ spaceId: ids.space, userId: ids.user, template: "spotlight", aspect: "9:16", reviewIds: [ids.review], rightsConfirmed: true });
    expect((fromKit.props as { brand: string }).brand).toBe("#0a7d5a");

    const explicit = await reviewVideos.createReviewVideo({ spaceId: ids.space, userId: ids.user, template: "spotlight", aspect: "9:16", reviewIds: [ids.review], rightsConfirmed: true, brandColor: "#abcdef" });
    expect((explicit.props as { brand: string }).brand).toBe("#abcdef");
  });

  it("is removed with its space", async () => {
    const [space] = await db.insert(s.spaces).values({ name: "BK temp", ownerId: ids.user, embedKey: `${ids.user}-t` }).returning();
    await kitService.saveBrandKit(space.id, input());
    await db.delete(s.spaces).where(eq(s.spaces.id, space.id));
    expect(await kitService.getBrandKit(space.id)).toBeNull();
  });
});
