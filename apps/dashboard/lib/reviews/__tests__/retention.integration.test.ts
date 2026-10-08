import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Real Postgres (migrations applied). Skipped unless TEST_DATABASE_URL is set.
 */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("third-party review text is not kept past the retention period (postgres)", () => {
  type Db = typeof import("@/lib/db").db;
  let db: Db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let purge: typeof import("../retention").purgeStaleReviewText;
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const userId = `retention-${Date.now()}`;
  let spaceId = "";
  const day = 24 * 60 * 60 * 1000;
  const now = new Date("2026-10-08T12:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * day);
  const rows: Record<string, string> = {};

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    ({ purgeStaleReviewText: purge } = await import("../retention"));
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;

    await db.insert(s.user).values({ id: userId, name: "Retention", email: `${userId}@example.test` });
    const [space] = await db.insert(s.spaces).values({ name: "Retention", ownerId: userId, embedKey: userId }).returning();
    spaceId = space.id;
    const add = async (key: string, provider: "google" | "trustpilot" | "own", fetchedDaysAgo: number | null, createdDaysAgo = 0) => {
      const [r] = await db
        .insert(s.reviews)
        .values({
          spaceId,
          provider,
          providerReviewId: `${userId}-${key}`,
          authorName: key,
          rating: provider === "own" ? null : 5,
          text: `text of ${key}`,
          textFetchedAt: fetchedDaysAgo === null ? null : ago(fetchedDaysAgo),
          createdAt: ago(createdDaysAgo),
        })
        .returning();
      rows[key] = r.id;
    };
    await add("old-google", "google", 45);
    await add("fresh-google", "google", 2);
    await add("old-trustpilot", "trustpilot", 31);
    await add("edge-trustpilot", "trustpilot", 29);
    await add("old-own", "own", null, 400); // the owner's own words are never purged
    await add("legacy-old", "google", null, 90); // from before the column existed: counted from creation
    await add("legacy-new", "google", null, 3);
  }, 600_000);

  afterAll(async () => {
    await db.delete(s.user).where(eq(s.user.id, userId));
    await pool?.end();
    await releaseLock?.();
  });

  const textOf = async (key: string) => (await db.select({ text: s.reviews.text }).from(s.reviews).where(eq(s.reviews.id, rows[key])))[0].text;

  it("removes third-party text older than the period and leaves everything else", async () => {
    // Other tests' rows may exist in the shared test database, so count only ours
    await purge(now, 30);
    expect(await textOf("old-google")).toBeNull();
    expect(await textOf("old-trustpilot")).toBeNull();
    expect(await textOf("legacy-old")).toBeNull();
    expect(await textOf("fresh-google")).toBe("text of fresh-google");
    expect(await textOf("edge-trustpilot")).toBe("text of edge-trustpilot");
    expect(await textOf("legacy-new")).toBe("text of legacy-new");
    expect(await textOf("old-own")).toBe("text of old-own");
  });

  it("keeps the review row itself (author, rating, date), only the text goes", async () => {
    const [row] = await db.select().from(s.reviews).where(eq(s.reviews.id, rows["old-google"]));
    expect(row).toMatchObject({ authorName: "old-google", rating: 5, text: null });
  });

  it("does nothing when the period is 0", async () => {
    await db.update(s.reviews).set({ text: "back again", textFetchedAt: ago(500) }).where(eq(s.reviews.id, rows["old-google"]));
    expect(await purge(now, 0)).toBe(0);
    expect(await textOf("old-google")).toBe("back again");
  });

  it("a second run finds nothing more to remove from rows it already cleared", async () => {
    await purge(now, 30); // clears "back again"
    expect(await textOf("old-google")).toBeNull();
    const again = await purge(now, 30);
    expect(typeof again).toBe("number");
    expect(await textOf("fresh-google")).toBe("text of fresh-google");
  });
});
