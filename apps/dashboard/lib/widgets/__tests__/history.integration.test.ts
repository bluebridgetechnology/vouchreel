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

run("widget history (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let service: typeof import("../service");
  let route: typeof import("@/app/api/spaces/[id]/widgets/[widgetId]/versions/route");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `hv${Date.now()}`;
  const owner = `${tag}-owner`;
  const stranger = `${tag}-stranger`;
  let space = "";
  let widget = "";
  let fresh = "";

  type Settings = Parameters<typeof import("../service").publishWidget>[1];
  const settings = (patch: Partial<Settings> = {}, theme: Record<string, unknown> = {}): Settings => ({
    template: "wall-of-love",
    position: "bottom-right",
    theme: { primaryColor: "#cf3d0b", accentColor: "#ffffff", mode: "light", borderRadius: 12, ...theme },
    triggerType: "delay",
    triggerValue: { seconds: 3 },
    pagesIncluded: ["*"],
    pagesExcluded: [],
    autoplayPreview: false,
    ...patch,
  });
  const versions = (id: string) => service.listVersions(id);
  const list = async (spaceId: string, widgetId: string) => {
    const res = await route.GET(new Request("http://x"), { params: Promise.resolve({ id: spaceId, widgetId }) });
    return { status: res.status, body: await res.json() };
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    service = await import("../service");
    route = await import("@/app/api/spaces/[id]/widgets/[widgetId]/versions/route");

    await db.insert(s.user).values([
      { id: owner, name: owner, email: `${owner}@example.test` },
      { id: stranger, name: stranger, email: `${stranger}@example.test` },
    ]);
    space = (await db.insert(s.spaces).values({ name: `${tag} a`, ownerId: owner, embedKey: `${tag}-key` }).returning())[0].id;
    // A widget that was already live before history existed
    widget = (await db.insert(s.widgetConfigs).values({ spaceId: space, name: "Wall", template: "carousel", isLive: true }).returning())[0].id;
    // A widget that was never shown
    fresh = (await db.insert(s.widgetConfigs).values({ spaceId: space, name: "New", sortOrder: 1, isLive: false }).returning())[0].id;
    session.userId = owner;
  }, 600_000);

  afterAll(async () => {
    if (db) {
      await db.delete(s.spaces).where(eq(s.spaces.id, space));
      await db.delete(s.user).where(eq(s.user.id, owner));
      await db.delete(s.user).where(eq(s.user.id, stranger));
    }
    await releaseLock?.();
  }, 60_000);

  it("a widget's first publish keeps how it was, so even that can be undone", async () => {
    await service.publishWidget(widget, settings({ template: "wall-of-love" }));
    const v = await versions(widget);
    expect(v.map((x) => [x.source, (x.config as { template: string }).template])).toEqual([
      ["publish", "wall-of-love"],
      ["before", "carousel"],
    ]);
  });

  it("a widget that was never shown has no 'before': only what was published", async () => {
    await service.publishWidget(fresh, settings());
    expect((await versions(fresh)).map((x) => x.source)).toEqual(["publish"]);
  });

  it("publishing the same thing again adds nothing", async () => {
    await service.publishWidget(widget, settings({ template: "wall-of-love" }));
    expect(await versions(widget)).toHaveLength(2);
  });

  it("keeps only the newest ten", async () => {
    for (let i = 0; i < 14; i++) await service.publishWidget(widget, settings({}, { borderRadius: i }));
    const v = await versions(widget);
    expect(v).toHaveLength(10);
    expect((v[0].config as { theme: { borderRadius: number } }).theme.borderRadius).toBe(13);
    expect((await db.select().from(s.widgetVersions).where(eq(s.widgetVersions.widgetId, widget)))).toHaveLength(10);
  });

  it("the versions route lists them newest first with what changed, marks the live one, and the settings that restore it", async () => {
    await service.publishWidget(widget, settings({ position: "bottom-left" }, { borderRadius: 13 }));
    const { status, body } = await list(space, widget);
    expect(status).toBe(200);
    expect(body.versions[0]).toMatchObject({ source: "publish", isLive: true, changed: ["Position"] });
    expect(body.versions[0].config).toMatchObject({ position: "bottom-left", template: "wall-of-love" });
    expect(body.versions.filter((v: { isLive: boolean }) => v.isLive)).toHaveLength(1);
    expect(body.versions[1]).toMatchObject({ isLive: false, changed: ["Look"] });
  });

  it("restoring is a publish of an old version: it goes live and is itself kept", async () => {
    const { body } = await list(space, widget);
    const old = body.versions[2];
    await service.publishWidget(widget, old.config);
    const after = await list(space, widget);
    expect(after.body.versions[0]).toMatchObject({ isLive: true, config: old.config });
  });

  it("only the space's owner can read it, and another space's widget is not found", async () => {
    session.userId = stranger;
    expect((await list(space, widget)).status).toBe(403);
    session.userId = owner;
    expect((await list(space, "00000000-0000-4000-8000-00000000dead")).status).toBe(404);
  });

  it("a version that no longer validates is left out instead of breaking the list", async () => {
    await db.insert(s.widgetVersions).values({ widgetId: widget, config: { template: "no-such-layout" }, source: "publish" });
    const { status, body } = await list(space, widget);
    expect(status).toBe(200);
    expect(body.versions.every((v: { config: { template: string } }) => v.config.template !== "no-such-layout")).toBe(true);
  });

  it("deleting a widget deletes its history", async () => {
    await service.deleteWidget(space, fresh);
    expect(await db.select().from(s.widgetVersions).where(eq(s.widgetVersions.widgetId, fresh))).toEqual([]);
  });
});
