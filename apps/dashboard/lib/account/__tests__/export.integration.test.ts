import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const mail = vi.hoisted(() => vi.fn(async () => ({ sent: true, provider: "resend" })));
vi.mock("@/lib/email/transport", () => ({ sendEmail: (...a: unknown[]) => mail(...(a as [])) }));

run("data export (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let ex: typeof import("../export");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `exp${Date.now()}`;
  const me = `${tag}-me`;
  const other = `${tag}-other`;
  let mySpace = "";
  let otherSpace = "";

  const unzip = (bytes: Uint8Array) => Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name, data]) => [name, strFromU8(data)]));

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    ex = await import("../export");
    await db.insert(s.user).values([
      { id: me, name: "Me", email: `${me}@example.test` },
      { id: other, name: "Other", email: `${other}@example.test` },
    ]);
    [{ id: mySpace }] = await db.insert(s.spaces).values({ name: "Mine", ownerId: me, embedKey: `${tag}-m` }).returning({ id: s.spaces.id });
    [{ id: otherSpace }] = await db.insert(s.spaces).values({ name: "Theirs", ownerId: other, embedKey: `${tag}-o` }).returning({ id: s.spaces.id });
    await db.insert(s.testimonials).values([
      { spaceId: mySpace, platform: "text", quote: "My testimonial text", customerName: "Ada" },
      { spaceId: otherSpace, platform: "text", quote: "SOMEONE ELSES testimonial", customerName: "Bob" },
    ]);
    await db.insert(s.apiKeys).values({ spaceId: mySpace, name: "ci key", keyHash: `hash-${tag}`, keyPrefix: "vr_abc" });
    await db.insert(s.webhookEndpoints).values({ spaceId: mySpace, url: "https://example.com/hook", secret: `whsec_${tag}`, events: ["testimonial.created"] });
    const [form] = await db.insert(s.collectionForms).values({ spaceId: mySpace, title: "Form", promptText: "Tell us", slug: `${tag}-f` }).returning();
    await db.insert(s.submissions).values({ formId: form.id, customerName: "Grace", customerEmail: "grace@example.test", type: "text", text: "From a form" });
  }, 120_000);

  beforeEach(async () => {
    mail.mockClear();
    await db.delete(s.jobs);
  });

  afterAll(async () => {
    await db.delete(s.jobs);
    await db.delete(s.user).where(eq(s.user.id, me));
    await db.delete(s.user).where(eq(s.user.id, other));
    await releaseLock?.();
  });

  it("holds the account's own data, including form submissions, and nobody else's", async () => {
    const { zip, counts } = await ex.buildExportZip(me);
    const files = unzip(zip);
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["README.txt", "profile.json", "spaces.json", "testimonials.json", "submissions.json"]));
    expect(files["testimonials.json"]).toContain("My testimonial text");
    expect(files["submissions.json"]).toContain("grace@example.test");
    expect(JSON.stringify(files)).not.toContain("SOMEONE ELSES");
    expect(JSON.parse(files["profile.json"]).email).toBe(`${me}@example.test`);
    expect(counts.testimonials).toBe(1);
  });

  it("leaves out credentials and secrets", async () => {
    const files = unzip((await ex.buildExportZip(me)).zip);
    const all = JSON.stringify(files);
    expect(all).not.toContain(`hash-${tag}`);
    expect(all).not.toContain(`whsec_${tag}`);
    expect(files["api_keys.json"]).toContain("ci key"); // the key's name and prefix are the person's; its hash is not
    expect(files["webhook_endpoints.json"]).toContain("https://example.com/hook");
  });

  it("is limited to one a day, runs as a job, keeps the zip private to its owner, and expires", async () => {
    const first = await ex.requestExport(me);
    expect(first).toHaveProperty("id");
    expect(await ex.requestExport(me)).toEqual({ tooSoon: true });
    const queued = await db.select().from(s.jobs).where(eq(s.jobs.type, "data_export"));
    expect(queued).toHaveLength(1);

    const id = (first as { id: string }).id;
    expect(await ex.exportZipFor(me, id)).toBeNull(); // not ready yet
    await ex.runExport(id);
    expect(mail).toHaveBeenCalledTimes(1);
    expect((await ex.latestExport(me))?.status).toBe("ready");
    expect(await ex.exportZipFor(me, id)).not.toBeNull();
    expect(await ex.exportZipFor(other, id)).toBeNull(); // someone else cannot fetch it

    await db.update(s.dataExports).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(s.dataExports.id, id));
    expect(await ex.exportZipFor(me, id)).toBeNull();
    expect(await ex.latestExport(me)).toBeNull(); // the expired row is gone
  });

  it("settles a failed export", async () => {
    const [row] = await db.insert(s.dataExports).values({ userId: other }).returning();
    await ex.failExport(row.id, new Error("boom"));
    expect(await ex.latestExport(other)).toMatchObject({ status: "failed", error: "boom" });
  });
});
