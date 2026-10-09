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

run("copy style (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let route: typeof import("@/app/api/spaces/[id]/widgets/[widgetId]/copy-style/route");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `cs${Date.now()}`;
  const owner = `${tag}-owner`;
  const stranger = `${tag}-stranger`;
  const spaceIds: string[] = [];
  let spaceA = "";
  let spaceB = "";
  let spaceX = "";
  let source = "";
  let sibling = "";
  let other = "";
  let foreign = "";

  const params = (id: string, widgetId: string) => ({ params: Promise.resolve({ id, widgetId }) });
  const list = (space: string, widget: string) => route.GET(new Request("http://x"), params(space, widget));
  const copy = (space: string, widget: string, body: unknown) => route.POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), params(space, widget));
  const row = async (id: string) => (await db.select().from(s.widgetConfigs).where(eq(s.widgetConfigs.id, id)))[0];

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    route = await import("@/app/api/spaces/[id]/widgets/[widgetId]/copy-style/route");

    await db.insert(s.user).values([
      { id: owner, name: owner, email: `${owner}@example.test` },
      { id: stranger, name: stranger, email: `${stranger}@example.test` },
    ]);
    const mk = async (ownerId: string, n: string) => (await db.insert(s.spaces).values({ name: `${tag} ${n}`, ownerId, embedKey: `${tag}-${n}` }).returning())[0].id;
    spaceA = await mk(owner, "a");
    spaceB = await mk(owner, "b");
    spaceX = await mk(stranger, "x");
    spaceIds.push(spaceA, spaceB, spaceX);
    const widget = async (spaceId: string, name: string, extra: Record<string, unknown> = {}) =>
      (await db.insert(s.widgetConfigs).values({ spaceId, name, ...extra } as typeof s.widgetConfigs.$inferInsert).returning())[0].id;
    source = await widget(spaceA, "Source", {
      template: "wall-of-love",
      theme: { primaryColor: "#112233", accentColor: "#ffffff", mode: "dark", borderRadius: 30, shape: "circle", showName: true, columns: 4 },
    });
    sibling = await widget(spaceA, "Sibling", { template: "floating-reel", sortOrder: 1, theme: { primaryColor: "#000000", accentColor: "#ffffff", mode: "light", borderRadius: 4, showName: false, columns: 2 } });
    other = await widget(spaceB, "Other space", { template: "carousel" });
    foreign = await widget(spaceX, "Not yours");
  }, 600_000);

  afterAll(async () => {
    if (db) {
      if (spaceIds.length) await db.delete(s.spaces).where(inArray(s.spaces.id, spaceIds));
      await db.delete(s.user).where(inArray(s.user.id, [owner, stranger]));
    }
    await releaseLock?.();
  }, 60_000);

  it("lists the owner's other widgets by space, this space first, never someone else's", async () => {
    session.userId = owner;
    const body = await (await list(spaceB, other)).json();
    expect(body.spaces.map((g: { spaceId: string }) => g.spaceId)).toEqual([spaceB, spaceA].filter((id) => body.spaces.some((g: { spaceId: string }) => g.spaceId === id)));
    const names = body.spaces.flatMap((g: { widgets: { name: string }[] }) => g.widgets.map((w) => w.name));
    expect(names).toEqual(expect.arrayContaining(["Source", "Sibling"]));
    expect(names).not.toContain("Not yours");
    expect(names).not.toContain("Other space"); // not itself
    const fromA = await (await list(spaceA, source)).json();
    expect(fromA.spaces[0].spaceId).toBe(spaceA); // the current space first
  });

  it("copies the look into drafts, leaves live settings alone, and keeps what the target shows", async () => {
    session.userId = owner;
    const before = await row(sibling);
    const res = await copy(spaceA, source, { targets: [{ spaceId: spaceA, widgetId: sibling }, { spaceId: spaceB, widgetId: other }] });
    expect(res.status).toBe(200);
    expect((await res.json()).copied).toHaveLength(2);

    const after = await row(sibling);
    expect(after.theme).toEqual(before.theme); // nothing live changed
    expect(after.isLive).toBe(before.isLive);
    const draft = after.draftConfig as { theme: Record<string, unknown>; template: string };
    expect(draft.template).toBe("floating-reel");
    expect(draft.theme).toMatchObject({ primaryColor: "#112233", mode: "dark", borderRadius: 30, showName: false, columns: 2, shape: null }); // a circle is not a reel shape
    expect((await row(other)).draftConfig).not.toBeNull();
  });

  it("builds on an existing draft instead of dropping its other edits", async () => {
    session.userId = owner;
    const current = (await row(sibling)).draftConfig as Record<string, unknown>;
    await db.update(s.widgetConfigs).set({ draftConfig: { ...current, position: "bottom-left" } }).where(eq(s.widgetConfigs.id, sibling));
    await db.update(s.widgetConfigs).set({ theme: { ...((await row(source)).theme as object), borderRadius: 10 } }).where(eq(s.widgetConfigs.id, source));
    await copy(spaceA, source, { targets: [{ spaceId: spaceA, widgetId: sibling }] });
    const draft = (await row(sibling)).draftConfig as { position: string; theme: { borderRadius: number } };
    expect(draft.position).toBe("bottom-left");
    expect(draft.theme.borderRadius).toBe(10);
  });

  it("skips other people's widgets, an id named with the wrong space, and the source itself, touching nothing", async () => {
    session.userId = owner;
    const res = await copy(spaceA, source, { targets: [{ spaceId: spaceX, widgetId: foreign }, { spaceId: spaceB, widgetId: sibling }, { spaceId: spaceA, widgetId: source }] });
    expect(await res.json()).toEqual({ copied: [], skipped: 3 });
    expect((await row(foreign)).draftConfig).toBeNull();
    expect((await row(source)).draftConfig).toBeNull();
  });

  it("only the source space's owner can copy from it; bad input and unknown widgets are refused", async () => {
    session.userId = stranger;
    expect((await copy(spaceA, source, { targets: [{ spaceId: spaceX, widgetId: foreign }] })).status).toBe(403);
    expect((await list(spaceA, source)).status).toBe(403);
    session.userId = owner;
    expect((await copy(spaceA, source, { targets: [] })).status).toBe(400);
    expect((await copy(spaceA, source, { targets: [{ spaceId: "x", widgetId: "y" }] })).status).toBe(400);
    expect((await copy(spaceA, "00000000-0000-4000-8000-00000000dead", { targets: [{ spaceId: spaceA, widgetId: sibling }] })).status).toBe(404);
    expect((await list(spaceA, other)).status).toBe(404); // a widget of another space, asked through this one
  });
});
