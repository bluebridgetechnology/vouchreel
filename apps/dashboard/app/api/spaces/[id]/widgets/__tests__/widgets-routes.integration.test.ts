import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Real Postgres, real route handlers. Skipped unless TEST_DATABASE_URL is set. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

let sessionUserId = "";
vi.mock("@/lib/auth/session", () => ({ getSession: async () => (sessionUserId ? { user: { id: sessionUserId } } : null) }));

run("widget routes (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let list: typeof import("../route");
  let one: typeof import("../[widgetId]/route");
  let draft: typeof import("../[widgetId]/draft/route");
  let legacy: typeof import("../../widget-config/route");
  let legacyDraft: typeof import("../../widget-config/draft/route");
  let defaults: typeof import("@/lib/validations/widget-config").DEFAULT_WIDGET_CONFIG;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `wr${Date.now()}`;
  const owners = { pro: `${tag}-pro`, free: `${tag}-free`, other: `${tag}-other` };
  const spaceIds: string[] = [];
  const planIds: string[] = [];

  const asUser = (id: string) => (sessionUserId = id);
  const req = (method: string, body?: unknown) => new Request("http://x", { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const ctx = (id: string, widgetId = "") => ({ params: Promise.resolve({ id, widgetId }) });
  const space = async (owner: string, n: string) => {
    const [row] = await db.insert(s.spaces).values({ name: `${tag} ${n}`, ownerId: owner, embedKey: `${tag}-${n}` }).returning();
    spaceIds.push(row.id);
    return row;
  };
  const withWidget = async (owner: string, n: string) => {
    const sp = await space(owner, n);
    const [w] = await db.insert(s.widgetConfigs).values({ spaceId: sp.id, ...defaults }).returning();
    return { sp, w };
  };
  const rowOf = async (id: string) => (await db.select().from(s.widgetConfigs).where(eq(s.widgetConfigs.id, id)))[0];

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    list = await import("../route");
    one = await import("../[widgetId]/route");
    draft = await import("../[widgetId]/draft/route");
    legacy = await import("../../widget-config/route");
    legacyDraft = await import("../../widget-config/draft/route");
    ({ DEFAULT_WIDGET_CONFIG: defaults } = await import("@/lib/validations/widget-config"));
    const { PLAN_LIMIT_PRESETS, serializeLimits } = await import("@/lib/payments/plan-limits");

    await db.insert(s.user).values(Object.values(owners).map((id) => ({ id, name: id, email: `${id}@example.test` })));
    const [plan] = await db.insert(s.plans).values({ name: `${tag} Pro`, price: 1900, interval: "month", limits: serializeLimits({ ...PLAN_LIMIT_PRESETS.pro, maxWidgetsPerSpace: 3 }) }).returning();
    planIds.push(plan.id);
    await db.insert(s.subscriptions).values({ userId: owners.pro, planId: plan.id, status: "active", provider: "manual" });
  }, 600_000);

  afterAll(async () => {
    sessionUserId = "";
    if (db) {
      if (spaceIds.length) await db.delete(s.spaces).where(inArray(s.spaces.id, spaceIds));
      await db.delete(s.subscriptions).where(inArray(s.subscriptions.userId, Object.values(owners)));
      if (planIds.length) await db.delete(s.plans).where(inArray(s.plans.id, planIds));
      await db.delete(s.user).where(inArray(s.user.id, Object.values(owners)));
    }
    await releaseLock?.();
  }, 60_000);

  it("only the space's owner gets in: 401 signed out, 403 for someone else, 404 for a space that is not there", async () => {
    const { sp, w } = await withWidget(owners.pro, "auth");
    asUser("");
    expect((await list.GET(req("GET"), ctx(sp.id))).status).toBe(401);
    expect((await one.PUT(req("PUT", defaults), ctx(sp.id, w.id))).status).toBe(401);
    asUser(owners.other);
    for (const res of [await list.GET(req("GET"), ctx(sp.id)), await list.POST(req("POST", {}), ctx(sp.id)), await one.GET(req("GET"), ctx(sp.id, w.id)), await one.PATCH(req("PATCH", { name: "x" }), ctx(sp.id, w.id)), await one.DELETE(req("DELETE"), ctx(sp.id, w.id)), await draft.PUT(req("PUT", defaults), ctx(sp.id, w.id)), await legacy.GET(req("GET"), ctx(sp.id))]) {
      expect(res.status).toBe(403);
    }
    expect((await rowOf(w.id)).name).toBe("Default widget"); // untouched
    asUser(owners.pro);
    expect((await list.GET(req("GET"), ctx("00000000-0000-0000-0000-000000000000"))).status).toBe(404);
  });

  it("lists the widgets with the plan's allowance, and creates the first one for a space that has none", async () => {
    const sp = await space(owners.pro, "empty");
    asUser(owners.pro);
    const res = await list.GET(req("GET"), ctx(sp.id));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.widgets).toHaveLength(1);
    expect(json.widgets[0]).toMatchObject({ name: "Default widget", isLive: true, hasDraft: false });
    expect(json.embedKey).toBe(sp.embedKey);
    expect(json.quota).toEqual({ current: 1, limit: 3, allowed: true });
  });

  it("creates a widget that is off, named, after the others; copies another's live settings; refuses bad input", async () => {
    const { sp, w } = await withWidget(owners.pro, "create");
    await db.update(s.widgetConfigs).set({ template: "carousel", name: "Hero" }).where(eq(s.widgetConfigs.id, w.id));
    asUser(owners.pro);

    const made = await list.POST(req("POST", { name: "  Footer wall  " }), ctx(sp.id));
    expect(made.status).toBe(201);
    expect((await made.json()).widget).toMatchObject({ name: "Footer wall", isLive: false, sortOrder: 1, template: defaults.template });

    const copy = await (await list.POST(req("POST", { duplicateOf: w.id }), ctx(sp.id))).json();
    expect(copy.widget).toMatchObject({ name: "Hero copy", isLive: false, template: "carousel" });

    expect((await list.POST(req("POST", { name: "x".repeat(61) }), ctx(sp.id))).status).toBe(400);
    expect((await list.POST(req("POST", { name: "   " }), ctx(sp.id))).status).toBe(400);
    // A widget of another space cannot be copied (a fresh space, so the plan limit is not what answers)
    const stranger = await withWidget(owners.other, "create-other");
    const fresh = await withWidget(owners.pro, "create-fresh");
    expect((await list.POST(req("POST", { duplicateOf: stranger.w.id }), ctx(fresh.sp.id))).status).toBe(404);
  });

  it("stops at the plan's limit with PLAN_LIMIT, and lets a free account keep just its one", async () => {
    const { sp } = await withWidget(owners.pro, "limit");
    asUser(owners.pro);
    expect((await list.POST(req("POST", {}), ctx(sp.id))).status).toBe(201);
    expect((await list.POST(req("POST", {}), ctx(sp.id))).status).toBe(201);
    const blocked = await list.POST(req("POST", {}), ctx(sp.id)); // a fourth
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error.code).toBe("PLAN_LIMIT");
    expect((await (await list.GET(req("GET"), ctx(sp.id))).json()).quota).toEqual({ current: 3, limit: 3, allowed: false });

    const free = await withWidget(owners.free, "limit-free");
    asUser(owners.free);
    expect((await list.POST(req("POST", {}), ctx(free.sp.id))).status).toBe(403);
  });

  it("a widget: read it, publish it (live, draft cleared), turn it off and on, rename it", async () => {
    const { sp, w } = await withWidget(owners.pro, "one");
    asUser(owners.pro);
    const added = (await (await list.POST(req("POST", { name: "Second" }), ctx(sp.id))).json()).widget;

    const view = await (await one.GET(req("GET"), ctx(sp.id, added.id))).json();
    expect(view.widget).toMatchObject({ id: added.id, name: "Second", isLive: false });
    expect(view.draft).toBeNull();
    expect(view.space).toMatchObject({ id: sp.id, embedKey: sp.embedKey });

    await draft.PUT(req("PUT", { ...defaults, template: "reel-feed" }), ctx(sp.id, added.id));
    expect((await (await one.GET(req("GET"), ctx(sp.id, added.id))).json()).draft.template).toBe("reel-feed");

    const published = await one.PUT(req("PUT", { ...defaults, template: "reel-feed", theme: { ...defaults.theme, mode: "dark" } }), ctx(sp.id, added.id));
    expect(published.status).toBe(200);
    expect(await rowOf(added.id)).toMatchObject({ isLive: true, template: "reel-feed", draftConfig: null });
    expect((await one.PUT(req("PUT", { ...defaults, template: "hexagon" }), ctx(sp.id, added.id))).status).toBe(400);

    const off = await one.PATCH(req("PATCH", { isLive: false }), ctx(sp.id, added.id));
    expect((await off.json()).widget.isLive).toBe(false);
    const renamed = await one.PATCH(req("PATCH", { name: "Pricing page", isLive: true }), ctx(sp.id, added.id));
    expect((await renamed.json()).widget).toMatchObject({ name: "Pricing page", isLive: true });
    expect((await one.PATCH(req("PATCH", {}), ctx(sp.id, added.id))).status).toBe(400);
    expect((await one.PATCH(req("PATCH", { name: "" }), ctx(sp.id, added.id))).status).toBe(400);
    expect((await rowOf(w.id)).name).toBe("Default widget"); // the other widget never changed
  });

  it("a draft belongs to its widget alone, and discarding it leaves the live settings", async () => {
    const { sp, w } = await withWidget(owners.pro, "drafts");
    asUser(owners.pro);
    const added = (await (await list.POST(req("POST", {}), ctx(sp.id))).json()).widget;
    expect((await draft.PUT(req("PUT", { ...defaults, template: "marquee" }), ctx(sp.id, added.id))).status).toBe(200);
    expect((await rowOf(added.id)).draftConfig).toMatchObject({ template: "marquee" });
    expect((await rowOf(w.id)).draftConfig).toBeNull();
    expect((await rowOf(added.id)).template).toBe(defaults.template); // visitors' settings unchanged
    expect((await draft.PUT(req("PUT", { ...defaults, template: "hexagon" }), ctx(sp.id, added.id))).status).toBe(400);
    expect((await draft.DELETE(req("DELETE"), ctx(sp.id, added.id))).status).toBe(200);
    expect((await rowOf(added.id)).draftConfig).toBeNull();
  });

  it("deleting: any but the last (409), another space's widget is a 404, and the next widget becomes the primary", async () => {
    const { sp, w } = await withWidget(owners.pro, "delete");
    asUser(owners.pro);
    const added = (await (await list.POST(req("POST", {}), ctx(sp.id))).json()).widget;
    const other = await withWidget(owners.pro, "delete-other");
    expect((await one.DELETE(req("DELETE"), ctx(sp.id, other.w.id))).status).toBe(404);
    expect((await one.DELETE(req("DELETE"), ctx(sp.id, w.id))).status).toBe(200);
    expect((await rowOf(w.id))).toBeUndefined();
    const last = await one.DELETE(req("DELETE"), ctx(sp.id, added.id));
    expect(last.status).toBe(409);
    expect((await last.json()).error.details).toEqual({ reason: "last_widget" });
    expect(await rowOf(added.id)).toBeDefined();
    // The legacy single-widget routes now mean the remaining widget
    const legacyView = await (await legacy.GET(req("GET"), ctx(sp.id))).json();
    expect(legacyView.widget.id).toBe(added.id);
  });

  it("the single-widget routes keep working, and mean the primary widget even when there are several", async () => {
    const { sp, w } = await withWidget(owners.pro, "legacy");
    asUser(owners.pro);
    await list.POST(req("POST", { name: "Second" }), ctx(sp.id));

    const before = await (await legacy.GET(req("GET"), ctx(sp.id))).json();
    expect(before.widgetConfig.id).toBe(w.id);
    expect(before).toHaveProperty("draft");
    expect(before.space).toMatchObject({ id: sp.id, embedKey: sp.embedKey });

    await legacyDraft.PUT(req("PUT", { ...defaults, template: "spotlight" }), ctx(sp.id));
    expect((await (await legacy.GET(req("GET"), ctx(sp.id))).json()).draft.template).toBe("spotlight");
    const published = await legacy.PUT(req("PUT", { ...defaults, template: "spotlight" }), ctx(sp.id));
    expect((await published.json()).widgetConfig).toMatchObject({ id: w.id, template: "spotlight" });
    expect((await rowOf(w.id)).draftConfig).toBeNull();
    expect((await legacy.PUT(req("PUT", { ...defaults, template: "hexagon" }), ctx(sp.id))).status).toBe(400);
    expect((await legacyDraft.DELETE(req("DELETE"), ctx(sp.id))).status).toBe(200);
    // ...and the other widget was never touched
    const second = (await db.select().from(s.widgetConfigs).where(eq(s.widgetConfigs.spaceId, sp.id))).find((r) => r.id !== w.id)!;
    expect(second.template).toBe(defaults.template);
  });
});
