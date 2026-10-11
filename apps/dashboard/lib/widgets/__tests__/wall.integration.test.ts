import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const session = vi.hoisted(() => ({ userId: "" }));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-nonce": "n0nce" }) }));
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

run("a widget's own page (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let widgetRoute: typeof import("@/app/api/spaces/[id]/widgets/[widgetId]/route");
  let publicRoute: typeof import("@/app/api/widget/[embedKey]/route");
  let page: typeof import("@/app/wall/[widgetId]/page");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `wl${Date.now()}`;
  const owner = `${tag}-owner`;
  let space = "";
  let wall = "";
  let floating = "";

  const patch = (widgetId: string, body: unknown) =>
    widgetRoute.PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: space, widgetId }) });
  const publicData = async (key: string) => {
    const res = await publicRoute.GET(new Request(`http://x/api/widget/${key}`), { params: Promise.resolve({ embedKey: key }) });
    return { status: res.status, body: await res.json() };
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    widgetRoute = await import("@/app/api/spaces/[id]/widgets/[widgetId]/route");
    publicRoute = await import("@/app/api/widget/[embedKey]/route");
    page = await import("@/app/wall/[widgetId]/page");

    await db.insert(s.user).values({ id: owner, name: owner, email: `${owner}@example.test` });
    space = (await db.insert(s.spaces).values({ name: `${tag} Acme`, ownerId: owner, embedKey: `${tag}-key` }).returning())[0].id;
    // The wall widget is off on the site and limited to one page, to show the page does not depend on either
    wall = (await db.insert(s.widgetConfigs).values({ spaceId: space, name: "Wall", sortOrder: 0, template: "wall-of-love", isLive: false, pagesIncluded: ["/pricing"], theme: { mode: "dark" } }).returning())[0].id;
    floating = (await db.insert(s.widgetConfigs).values({ spaceId: space, name: "Corner", sortOrder: 1, template: "floating-card" }).returning())[0].id;
    await db.insert(s.testimonials).values({ spaceId: space, platform: "youtube", quote: "Great", customerName: "Pat", isActive: true } as typeof s.testimonials.$inferInsert);
    session.userId = owner;
  }, 600_000);

  afterAll(async () => {
    if (db) {
      await db.delete(s.spaces).where(eq(s.spaces.id, space));
      await db.delete(s.user).where(eq(s.user.id, owner));
    }
    await releaseLock?.();
  }, 60_000);

  it("is off until the owner turns it on, and then the public data and the page exist", async () => {
    expect((await publicData(`wall-${wall}`)).status).toBe(404);
    await expect(page.default({ params: Promise.resolve({ widgetId: wall }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK|NEXT_NOT_FOUND/);

    const res = await patch(wall, { wallEnabled: true });
    expect(res.status).toBe(200);
    expect((await res.json()).widget.wallEnabled).toBe(true);

    const { status, body } = await publicData(`wall-${wall}`);
    expect(status).toBe(200);
    expect(body.config).toMatchObject({ id: wall, template: "wall-of-love", pagesIncluded: ["*"], pagesExcluded: [] }); // page rules do not apply
    expect(body.widgets).toBeUndefined();
    expect(body.activeExperiment).toBeNull();
    expect(body.testimonials).toHaveLength(1);

    const element = await page.default({ params: Promise.resolve({ widgetId: wall }) });
    const html = JSON.stringify(element);
    expect(html).toContain(`wall-${wall}`);
    expect(html).toContain("What customers say about");
  });

  it("does not disturb the space's normal embed", async () => {
    const { body } = await publicData(`${tag}-key`);
    expect(body.config.id).toBe(floating); // the only widget live on the site
  });

  it("turning it off stops the page and the data; a made-up or malformed id finds nothing", async () => {
    await patch(wall, { wallEnabled: false });
    expect((await publicData(`wall-${wall}`)).status).toBe(404);
    expect((await publicData("wall-00000000-0000-4000-8000-00000000dead")).status).toBe(404);
    await expect(page.default({ params: Promise.resolve({ widgetId: "not-a-uuid" }) })).rejects.toThrow();
  });

  it("only a widget that sits in a page can have a page: a corner widget is refused", async () => {
    const res = await patch(floating, { wallEnabled: true });
    expect(res.status).toBe(409);
    expect((await db.select().from(s.widgetConfigs).where(eq(s.widgetConfigs.id, floating)))[0].wallEnabled).toBe(false);
  });

  it("a page that was on stops when the published layout changes to a corner one", async () => {
    await patch(wall, { wallEnabled: true });
    await db.update(s.widgetConfigs).set({ template: "floating-card" }).where(eq(s.widgetConfigs.id, wall));
    expect((await publicData(`wall-${wall}`)).status).toBe(404);
    await db.update(s.widgetConfigs).set({ template: "wall-of-love" }).where(eq(s.widgetConfigs.id, wall));
  });

  it("only the space's owner can change it", async () => {
    session.userId = "someone-else";
    expect((await patch(wall, { wallEnabled: false })).status).toBe(403);
    session.userId = owner;
    expect((await patch(wall, {})).status).toBe(400);
  });
});
