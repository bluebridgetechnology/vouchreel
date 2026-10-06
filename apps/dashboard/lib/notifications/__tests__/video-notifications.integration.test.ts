import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The notification and email path for takedowns and withdrawals, with the real notification
 * service and database (only the mail transport and storage are replaced). Skipped unless
 * TEST_DATABASE_URL is set.
 */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const mail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/transport", () => ({ sendEmail: async (m: unknown) => (mail(m), { sent: true, provider: "resend" }) }));
vi.mock("@/lib/storage", () => ({ getStorage: () => ({ delete: async () => {} }) }));

run("owner notifications for removed videos and withdrawn consent (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let moderation: typeof import("@/lib/admin/moderation");
  let withdrawal: typeof import("@/lib/ai-video/consent-withdrawal");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `nt${Date.now()}`;
  const owner = `${tag}-owner`;
  const admin = `${tag}-admin`;
  let spaceId = "";
  let testimonialId = "";

  const waitFor = async <T,>(read: () => Promise<T | undefined>) => {
    for (let i = 0; i < 50; i++) {
      const value = await read();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 40));
    }
    throw new Error("timed out waiting for the notification");
  };
  const notificationOf = (type: string) =>
    waitFor(async () => (await db.select().from(s.notifications).where(eq(s.notifications.userId, owner))).find((n) => n.type === type));

  async function seedVideo(urlPart: string) {
    const [c] = await db.insert(s.testimonialConsents).values({ testimonialId, spaceId, source: "collect_form", textVersion: "v1", grantedAt: new Date() }).returning();
    const [v] = await db
      .insert(s.generatedVideos)
      .values({ spaceId, testimonialId, consentId: c.id, status: "done", template: "b", voice: "v", scriptOriginal: "words here now", outputUrl: `https://cdn.test/ai-videos/${spaceId}/${urlPart}.mp4` })
      .returning();
    return { consent: c, video: v };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.BETTER_AUTH_SECRET = "a-test-secret-of-sufficient-length-0123456789";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    moderation = await import("@/lib/admin/moderation");
    withdrawal = await import("@/lib/ai-video/consent-withdrawal");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values([
      { id: owner, name: "Owner", email: `${owner}@example.test` },
      { id: admin, name: "Admin", email: `${admin}@example.test`, isPlatformAdmin: true },
    ]);
    const [space] = await db.insert(s.spaces).values({ name: tag, ownerId: owner, embedKey: tag }).returning();
    spaceId = space.id;
    testimonialId = (await db.insert(s.testimonials).values({ spaceId, platform: "text", quote: "Nice." }).returning())[0].id;
  }, 600_000);

  beforeEach(async () => {
    mail.mockClear();
    await db.delete(s.notifications).where(eq(s.notifications.userId, owner));
    await db.delete(s.notificationPreferences).where(eq(s.notificationPreferences.userId, owner));
  });

  afterAll(async () => {
    await db.delete(s.notifications).where(eq(s.notifications.userId, owner));
    await db.delete(s.notificationPreferences).where(eq(s.notificationPreferences.userId, owner));
    await db.delete(s.generatedVideos).where(eq(s.generatedVideos.spaceId, spaceId));
    await db.delete(s.spaces).where(eq(s.spaces.id, spaceId));
    await db.delete(s.user).where(eq(s.user.id, owner));
    await db.delete(s.user).where(eq(s.user.id, admin));
    await pool?.end();
    await releaseLock?.();
  });

  it("a takedown puts the reason in the owner's inbox and in an email to them", async () => {
    const { video } = await seedVideo("takedown");
    expect((await moderation.takeDownVideo("ai", video.id, admin, "Misleading claim in the script")).ok).toBe(true);

    const n = await notificationOf("video.removed");
    expect(n).toMatchObject({ title: "A video was removed by our team", body: "Misleading claim in the script", href: `/spaces/${spaceId}`, readAt: null });
    const message = await waitFor(async () => mail.mock.calls[0]?.[0] as { to: string; subject: string; text: string; html: string } | undefined);
    expect(message.to).toBe(`${owner}@example.test`);
    expect(message.subject).toContain("A video was removed by our team");
    expect(message.text).toContain("Misleading claim in the script");
    expect(message.html).toContain(`https://app.example.test/spaces/${spaceId}`); // the button opens the app
  });

  it("a withdrawal tells the owner how many videos went", async () => {
    const { consent } = await seedVideo("withdrawn");
    await withdrawal.withdrawConsent(consent.id, "customer");
    const n = await notificationOf("consent.withdrawn");
    expect(n.title).toBe("A customer withdrew their AI video consent");
    expect(n.body).toContain("1 video was removed");
    const message = await waitFor(async () => mail.mock.calls[0]?.[0] as { to: string; text: string } | undefined);
    expect(message.to).toBe(`${owner}@example.test`);
    expect(message.text).toContain("1 video was removed");
  });

  it("respects an owner who turned the email off: the inbox entry stays, no email is sent", async () => {
    await db.insert(s.notificationPreferences).values({ userId: owner, type: "consent.withdrawn", inApp: true, email: false });
    const { consent } = await seedVideo("prefs");
    await withdrawal.withdrawConsent(consent.id, "owner");
    await notificationOf("consent.withdrawn");
    await new Promise((r) => setTimeout(r, 200));
    expect(mail).not.toHaveBeenCalled();
  });
});
