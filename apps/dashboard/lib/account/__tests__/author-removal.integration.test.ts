import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("removing a testimonial author's data (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let rm: typeof import("../author-removal");
  let csv: typeof import("../consent-csv");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `ar${Date.now()}`;
  const owner = `${tag}-owner`;
  const rival = `${tag}-rival`;
  let space = "";
  let rivalSpace = "";
  let formId = "";
  let rivalFormId = "";
  const ids = { keep: "", gone: "" };

  const cleanupKeys = async () => (await db.select().from(s.jobs).where(eq(s.jobs.type, "file_cleanup"))).flatMap((j) => j.payload.keys as string[]).sort();

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    rm = await import("../author-removal");
    csv = await import("../consent-csv");
    await db.insert(s.user).values([
      { id: owner, name: "O", email: `${owner}@example.test` },
      { id: rival, name: "R", email: `${rival}@example.test` },
    ]);
    [{ id: space }] = await db.insert(s.spaces).values({ name: "S", ownerId: owner, embedKey: `${tag}-s` }).returning({ id: s.spaces.id });
    [{ id: rivalSpace }] = await db.insert(s.spaces).values({ name: "RS", ownerId: rival, embedKey: `${tag}-r` }).returning({ id: s.spaces.id });
    [{ id: formId }] = await db.insert(s.collectionForms).values({ spaceId: space, title: "F", promptText: "Say", slug: `${tag}-f` }).returning({ id: s.collectionForms.id });
    [{ id: rivalFormId }] = await db.insert(s.collectionForms).values({ spaceId: rivalSpace, title: "F", promptText: "Say", slug: `${tag}-rf` }).returning({ id: s.collectionForms.id });
  }, 120_000);

  beforeEach(async () => {
    await db.delete(s.jobs);
  });

  afterAll(async () => {
    await db.delete(s.jobs);
    await db.delete(s.user).where(eq(s.user.id, owner));
    await db.delete(s.user).where(eq(s.user.id, rival));
    await releaseLock?.();
  });

  async function author(email: string, name: string, form = formId, sp = space, withVideo = true) {
    const [sub] = await db
      .insert(s.submissions)
      .values({ formId: form, type: "video", customerName: name, customerEmail: email, videoUrl: withVideo ? `https://cdn.test/submissions/${tag}-${name}.mp4` : null })
      .returning();
    const [t] = await db.insert(s.testimonials).values({ spaceId: sp, platform: "mp4", quote: `${name} says hi`, customerName: name, videoUrl: sub.videoUrl }).returning();
    await db.insert(s.testimonialConsents).values({ testimonialId: t.id, spaceId: sp, source: "collect_form", textVersion: "v1", grantedAt: new Date(), submissionId: sub.id });
    return { sub, t };
  }

  it("previews, then removes the submissions and testimonials for an email (any letter case), queues their files, and leaves everyone else", async () => {
    const gone = await author("Ada@Example.test", "Ada");
    const keep = await author("grace@example.test", "Grace");
    ids.gone = gone.t.id;
    ids.keep = keep.t.id;
    const rivals = await author("ada@example.test", "RivalAda", rivalFormId, rivalSpace); // the same email in another owner's space

    expect(await rm.previewRemoval(owner, "ada@example.test")).toEqual({ submissions: 1, testimonials: 1 });
    expect(await db.select().from(s.testimonials).where(eq(s.testimonials.id, gone.t.id))).toHaveLength(1); // a preview deletes nothing

    expect(await rm.removeByEmail(owner, " ADA@example.test ")).toMatchObject({ submissions: 1, testimonials: 1 });
    expect(await db.select().from(s.testimonials).where(eq(s.testimonials.id, gone.t.id))).toHaveLength(0);
    expect(await db.select().from(s.submissions).where(eq(s.submissions.id, gone.sub.id))).toHaveLength(0);
    expect(await db.select().from(s.testimonials).where(eq(s.testimonials.id, keep.t.id))).toHaveLength(1);
    expect(await db.select().from(s.testimonials).where(eq(s.testimonials.id, rivals.t.id))).toHaveLength(1);
    expect(await cleanupKeys()).toEqual([`submissions/${tag}-Ada.mp4`]);
  });

  it("finds nothing for an email that gave no testimonial, and does nothing", async () => {
    expect(await rm.removeByEmail(owner, "nobody@example.test")).toEqual({ submissions: 0, testimonials: 0, files: 0 });
  });

  it("lists the space's consent records as CSV, with the email from the submission", async () => {
    const text = await csv.consentsCsv(space);
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toBe("testimonial_id,customer_name,customer_email,kind,source,wording_version,granted_at,withdrawn_at");
    expect(text).toContain("grace@example.test");
    expect(text).not.toContain("RivalAda");
  });
});
