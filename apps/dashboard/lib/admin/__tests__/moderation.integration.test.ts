import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const storage = vi.hoisted(() => ({ delete: vi.fn(async (_key: string) => {}) }));
const notified = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: (...a: unknown[]) => notified(...a), createNotification: vi.fn() }));

run("admin video moderation (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let mod: typeof import("../moderation");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `mod${Date.now()}`;
  const users = { owner: `${tag}-owner`, other: `${tag}-other`, admin: `${tag}-admin` };
  const spaceIds: string[] = [];
  const testimonialIds: string[] = [];
  const v: Record<string, string> = {}; // named video ids
  let spaceA = "";
  let spaceB = "";

  const at = (n: number) => new Date(Date.UTC(2031, 5, n, 10)); // June 2031: nothing else writes there

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    mod = await import("../moderation");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    const { AI_VIDEO_CONSENT_VERSION } = await import("@/lib/ai-video/consent");

    await db.insert(s.user).values([
      { id: users.owner, name: "Owner", email: `${tag}-owner@example.test` },
      { id: users.other, name: "Other", email: `${tag}-other@example.test` },
      { id: users.admin, name: "Admin", email: `${tag}-admin@example.test` },
    ]);
    const [a] = await db.insert(s.spaces).values({ name: `${tag} Alpha`, ownerId: users.owner, embedKey: `${tag}-a` }).returning();
    const [b] = await db.insert(s.spaces).values({ name: `${tag} Beta_100%`, ownerId: users.other, embedKey: `${tag}-b` }).returning();
    spaceA = a.id;
    spaceB = b.id;
    spaceIds.push(a.id, b.id);

    const consentFor = async (space: string, over: { revokedAt?: Date; textVersion?: string } = {}) => {
      const [t] = await db.insert(s.testimonials).values({ spaceId: space, platform: "text", quote: "Great product.", customerName: "Ada", customerCompany: "Analytical Co" }).returning();
      testimonialIds.push(t.id);
      const [c] = await db
        .insert(s.testimonialConsents)
        .values({ testimonialId: t.id, spaceId: space, source: "collect_form", textVersion: over.textVersion ?? AI_VIDEO_CONSENT_VERSION, grantedAt: at(1), revokedAt: over.revokedAt })
        .returning();
      return { t: t.id, c: c.id };
    };
    const ai = async (name: string, space: string, consent: { t: string; c: string }, day: number, over: Record<string, unknown> = {}) => {
      const [row] = await db
        .insert(s.generatedVideos)
        .values({
          spaceId: space,
          testimonialId: consent.t,
          consentId: consent.c,
          status: "done",
          template: "bold",
          voice: "v",
          scriptOriginal: "The original words of the testimonial.",
          scriptTrimmed: "The trimmed words.",
          outputUrl: `https://cdn.test/ai-videos/${space}/${consent.t}/${name}-x.mp4`,
          createdAt: at(day),
          ...over,
        })
        .returning();
      v[name] = row.id;
    };
    const review = async (name: string, space: string, day: number, over: Record<string, unknown> = {}) => {
      const [row] = await db
        .insert(s.reviewVideos)
        .values({
          spaceId: space,
          template: "spotlight",
          status: "done",
          props: { reviews: [{ author: "Maya", text: "Setup took ten minutes." }, { author: "Dan", text: "Lovely team." }] },
          rightsConfirmedAt: at(1),
          outputUrl: `https://cdn.test/review-videos/${space}/${name}-x.mp4`,
          createdAt: at(day),
          ...over,
        })
        .returning();
      v[name] = row.id;
    };

    const fine = await consentFor(a.id);
    const revoked = await consentFor(a.id, { revokedAt: at(5), textVersion: "2025-01-old" });
    const second = await consentFor(b.id);
    await ai("aiLive", a.id, fine, 10);
    await ai("aiRevoked", a.id, revoked, 11);
    await ai("aiBeta", b.id, second, 12);
    await ai("aiOwnerDeleted", a.id, fine, 13, { outputUrl: null, deletedAt: at(14) }); // nothing to take down
    await ai("aiFailed", a.id, fine, 14, { status: "failed", outputUrl: null });
    await ai("aiRemoved", a.id, fine, 15, { outputUrl: null, moderatedAt: at(16), moderatedBy: users.admin, moderationReason: "Misleading claim" });
    await review("revLive", a.id, 20);
    await review("revBeta", b.id, 21);
    await review("revRemoved", b.id, 22, { outputUrl: null, moderatedAt: at(23), moderatedBy: users.admin, moderationReason: "Complaint" });
  }, 600_000);

  beforeEach(() => {
    storage.delete.mockReset();
    storage.delete.mockResolvedValue(undefined);
    notified.mockClear();
  });

  afterAll(async () => {
    await db.delete(s.generatedVideos).where(inArray(s.generatedVideos.spaceId, spaceIds));
    await db.delete(s.reviewVideos).where(inArray(s.reviewVideos.spaceId, spaceIds));
    await db.delete(s.testimonialConsents).where(inArray(s.testimonialConsents.spaceId, spaceIds));
    await db.delete(s.testimonials).where(inArray(s.testimonials.id, testimonialIds));
    await db.delete(s.spaces).where(inArray(s.spaces.id, spaceIds));
    await db.delete(s.user).where(inArray(s.user.id, Object.values(users)));
    await pool?.end();
    await releaseLock?.();
  });

  const ids = async (query: Parameters<typeof mod.listModerationItems>[0], page = 1, size = 50) =>
    (await mod.listModerationItems({ q: tag, ...query }, page, size)).items.map((i) => i.id);

  it("lists only videos that have a file or were taken down, newest first, across both kinds", async () => {
    const all = await mod.listModerationItems({ q: tag });
    expect(all.total).toBe(7);
    expect(all.items.map((i) => i.id)).toEqual([v.revRemoved, v.revBeta, v.revLive, v.aiRemoved, v.aiBeta, v.aiRevoked, v.aiLive]);
    for (const hidden of ["aiOwnerDeleted", "aiFailed"]) expect(all.items.map((i) => i.id)).not.toContain(v[hidden]);
  });

  it("filters by kind and by state", async () => {
    expect(await ids({ kind: "ai" })).toEqual([v.aiRemoved, v.aiBeta, v.aiRevoked, v.aiLive]);
    expect(await ids({ kind: "review" })).toEqual([v.revRemoved, v.revBeta, v.revLive]);
    expect(await ids({ filter: "live" })).toEqual([v.revBeta, v.revLive, v.aiBeta, v.aiRevoked, v.aiLive]);
    expect(await ids({ filter: "removed" })).toEqual([v.revRemoved, v.aiRemoved]);
    expect(await ids({ filter: "attention" })).toEqual([v.aiRevoked]); // consent withdrawn but still up; review videos never match
  });

  it("searches the owner's email and the space name, treating wildcards literally", async () => {
    expect((await ids({ q: `${tag}-other` })).sort()).toEqual([v.revBeta, v.revRemoved, v.aiBeta].sort());
    expect((await ids({ q: "Alpha" })).sort()).toEqual([v.revLive, v.aiRemoved, v.aiRevoked, v.aiLive].sort());
    expect(await ids({ q: "Beta_100%" })).toHaveLength(3);
    expect(await ids({ q: "Beta_100%".replace("_", "-") })).toHaveLength(0);
    expect(await ids({ q: "%" })).toHaveLength(3); // only the space whose name has a percent sign
  });

  it("shows what each video says, who it quotes, and the permission behind it", async () => {
    const items = (await mod.listModerationItems({ q: tag })).items;
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId[v.aiLive]).toMatchObject({ kind: "ai", content: "The trimmed words.", attribution: "Ada, Analytical Co", ownerEmail: `${tag}-owner@example.test`, spaceName: `${tag} Alpha`, needsAttention: false });
    expect(byId[v.aiLive].consent).toMatchObject({ source: "collect_form", currentWording: true, revokedAt: null });
    expect(byId[v.aiRevoked]).toMatchObject({ needsAttention: true });
    expect(byId[v.aiRevoked].consent).toMatchObject({ currentWording: false, textVersion: "2025-01-old" });
    expect(byId[v.aiRevoked].consent?.revokedAt).not.toBeNull();
    expect(byId[v.revLive]).toMatchObject({ kind: "review", content: "Setup took ten minutes.  |  Lovely team.", attribution: "Maya, Dan", consent: null, needsAttention: false });
    expect(byId[v.revLive].rightsConfirmedAt).not.toBeNull();
    // Seeded without a wording version, like a video made before it was recorded
    expect(byId[v.revLive].rightsWording).toEqual({ version: null, current: false });
    expect(byId[v.aiLive].rightsWording).toBeNull();
    expect(byId[v.aiRemoved].removed).toMatchObject({ reason: "Misleading claim", byEmail: `${tag}-admin@example.test` });
  });

  it("pages across both kinds without overlap or gaps", async () => {
    const p1 = await ids({}, 1, 3);
    const p2 = await ids({}, 2, 3);
    const p3 = await ids({}, 3, 3);
    expect([p1.length, p2.length, p3.length]).toEqual([3, 3, 1]);
    expect(new Set([...p1, ...p2, ...p3]).size).toBe(7);
    expect((await mod.listModerationItems({ q: tag }, 0, 3)).page).toBe(1);
    const last = Math.ceil((await mod.listModerationItems({ q: tag }, 1, 3)).total / 3);
    expect((await mod.listModerationItems({ q: tag }, 999, 3)).page).toBe(last);
  });

  it("takes a video down: deletes the file, clears the URL, records who and why, tells the owner", async () => {
    const r = await mod.takeDownVideo("ai", v.aiLive, users.admin, "Customer asked us to remove it");
    expect(r).toMatchObject({ ok: true, kind: "ai", ownerEmail: `${tag}-owner@example.test` });
    expect(storage.delete).toHaveBeenCalledWith(`ai-videos/${spaceA}/${(await db.select().from(s.generatedVideos).where(eq(s.generatedVideos.id, v.aiLive)))[0].testimonialId}/aiLive-x.mp4`);
    const [row] = await db.select().from(s.generatedVideos).where(eq(s.generatedVideos.id, v.aiLive));
    expect(row).toMatchObject({ outputUrl: null, moderatedBy: users.admin, moderationReason: "Customer asked us to remove it", status: "done" });
    expect(row.moderatedAt).not.toBeNull();
    expect(notified).toHaveBeenCalledWith(spaceA, expect.objectContaining({ type: "video.removed", body: "Customer asked us to remove it" }));
    // The credit stays spent: the row is still done and still counted
    expect(await ids({ filter: "removed" })).toContain(v.aiLive);
  });

  it("takes a review video down the same way", async () => {
    expect((await mod.takeDownVideo("review", v.revLive, users.admin, "Reviewer complained")).ok).toBe(true);
    expect(storage.delete).toHaveBeenCalledWith(`review-videos/${spaceA}/revLive-x.mp4`);
    const [row] = await db.select().from(s.reviewVideos).where(eq(s.reviewVideos.id, v.revLive));
    expect(row).toMatchObject({ outputUrl: null, moderatedBy: users.admin });
  });

  it("refuses a second takedown, a video with no file, and an unknown video, without touching storage", async () => {
    expect(await mod.takeDownVideo("ai", v.aiRemoved, users.admin, "again please")).toMatchObject({ ok: false, reason: "already_removed" });
    expect(await mod.takeDownVideo("ai", v.aiOwnerDeleted, users.admin, "no file here")).toMatchObject({ ok: false, reason: "no_file" });
    expect(await mod.takeDownVideo("ai", "00000000-0000-4000-8000-000000000000", users.admin, "who is this")).toMatchObject({ ok: false, reason: "not_found" });
    expect(storage.delete).not.toHaveBeenCalled();
    expect(notified).not.toHaveBeenCalled();
  });

  it("changes nothing when the file cannot be deleted, so the takedown can be retried", async () => {
    storage.delete.mockRejectedValueOnce(new Error("bucket unreachable"));
    const failed = await mod.takeDownVideo("review", v.revBeta, users.admin, "Must go now");
    expect(failed).toMatchObject({ ok: false, reason: "storage_failed" });
    expect((failed as { message: string }).message).toContain("bucket unreachable");
    const [untouched] = await db.select().from(s.reviewVideos).where(eq(s.reviewVideos.id, v.revBeta));
    expect(untouched.outputUrl).not.toBeNull();
    expect(untouched.moderatedAt).toBeNull();
    expect(notified).not.toHaveBeenCalled();

    expect((await mod.takeDownVideo("review", v.revBeta, users.admin, "Must go now")).ok).toBe(true); // retry works
    expect(notified).toHaveBeenCalledTimes(1);
  });

  it("does not guess when the URL is not one of ours", async () => {
    await db.update(s.generatedVideos).set({ outputUrl: "https://elsewhere.test/video.mp4" }).where(eq(s.generatedVideos.id, v.aiBeta));
    expect(await mod.takeDownVideo("ai", v.aiBeta, users.admin, "odd url here")).toMatchObject({ ok: false, reason: "cannot_locate_file" });
    expect(storage.delete).not.toHaveBeenCalled();
    const [row] = await db.select().from(s.generatedVideos).where(eq(s.generatedVideos.id, v.aiBeta));
    expect(row.moderatedAt).toBeNull();
  });
});
