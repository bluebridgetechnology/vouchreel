import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("several widgets per space (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let s: typeof import("@/lib/db/schema");
  let svc: typeof import("../service");
  let defaults: typeof import("@/lib/validations/widget-config").DEFAULT_WIDGET_CONFIG;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `wid${Date.now()}`;
  const owners = { free: `${tag}-free`, pro: `${tag}-pro`, big: `${tag}-big`, fresh: `${tag}-fresh` };
  const spaceIds: string[] = [];
  const planIds: string[] = [];
  const space = async (owner: string, n: string) => {
    const [row] = await db.insert(s.spaces).values({ name: `${tag} ${n}`, ownerId: owner, embedKey: `${tag}-${n}` }).returning();
    spaceIds.push(row.id);
    return row;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq, inArray } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    svc = await import("../service");
    ({ DEFAULT_WIDGET_CONFIG: defaults } = await import("@/lib/validations/widget-config"));
    const { PLAN_LIMIT_PRESETS, serializeLimits } = await import("@/lib/payments/plan-limits");

    await db.insert(s.user).values(Object.values(owners).map((id) => ({ id, name: id, email: `${id}@example.test` })));
    // A real "free" plan is not needed: with no subscription the owner gets the free preset (one widget).
    const mkPlan = async (name: string, limits: Parameters<typeof serializeLimits>[0]) => {
      const [plan] = await db.insert(s.plans).values({ name: `${tag} ${name}`, price: 1900, interval: "month", limits: serializeLimits(limits) }).returning();
      planIds.push(plan.id);
      return plan.id;
    };
    const proPlan = await mkPlan("Pro", { ...PLAN_LIMIT_PRESETS.pro, maxWidgetsPerSpace: 3 });
    const bigPlan = await mkPlan("Agency", PLAN_LIMIT_PRESETS.agency);
    await db.insert(s.subscriptions).values([
      { userId: owners.pro, planId: proPlan, status: "active", provider: "manual" },
      { userId: owners.big, planId: bigPlan, status: "active", provider: "manual" },
    ]);
  }, 600_000);

  afterAll(async () => {
    if (db) {
      if (spaceIds.length) await db.delete(s.spaces).where(inArray(s.spaces.id, spaceIds)); // widgets go with them
      await db.delete(s.subscriptions).where(inArray(s.subscriptions.userId, Object.values(owners)));
      if (planIds.length) await db.delete(s.plans).where(inArray(s.plans.id, planIds));
      await db.delete(s.user).where(inArray(s.user.id, Object.values(owners)));
    }
    await releaseLock?.();
  }, 60_000);

  const insertFirst = async (spaceId: string, over: Record<string, unknown> = {}) => (await db.insert(s.widgetConfigs).values({ spaceId, ...defaults, ...over }).returning())[0];

  it("a widget that exists before there can be several is live and named, and is the primary", async () => {
    const sp = await space(owners.pro, "first");
    const first = await insertFirst(sp.id);
    expect(first).toMatchObject({ name: "Default widget", sortOrder: 0, isLive: true });
    expect((await svc.getPrimaryWidget(sp.id))?.id).toBe(first.id);
    expect((await svc.getExperimentTarget(sp.id))?.id).toBe(first.id);
  });

  it("a new widget starts off with the defaults, goes after the others, and never reaches visitors until published", async () => {
    const sp = await space(owners.pro, "create");
    const first = await insertFirst(sp.id, { template: "carousel" });
    const second = await svc.createWidget(sp.id, { name: "Footer wall" });
    expect(second).toMatchObject({ name: "Footer wall", sortOrder: 1, isLive: false, template: defaults.template, position: defaults.position });
    expect((await svc.listWidgets(sp.id)).map((w) => w.id)).toEqual([first.id, second.id]);
    expect((await svc.getLiveWidgets(sp.id)).map((w) => w.id)).toEqual([first.id]);

    const published = await svc.publishWidget(second.id, { ...defaults, template: "wall-of-love", theme: { ...defaults.theme, mode: "dark" } });
    expect(published).toMatchObject({ isLive: true, template: "wall-of-love", draftConfig: null });
    expect(published.publishedAt).toBeInstanceOf(Date);
    expect((await svc.getLiveWidgets(sp.id)).map((w) => w.id)).toEqual([first.id, second.id]);
  });

  it("a copy takes the live settings of the widget it copies, not its unpublished edits, and starts off", async () => {
    const sp = await space(owners.pro, "copy");
    const first = await insertFirst(sp.id, { name: "Hero", template: "spotlight", draftConfig: { ...defaults, template: "marquee" } });
    const copy = await svc.createWidget(sp.id, { name: "Hero copy", copyOf: first });
    expect(copy).toMatchObject({ name: "Hero copy", template: "spotlight", isLive: false, draftConfig: null });
    expect(copy.id).not.toBe(first.id);
  });

  it("drafts save and clear per widget, leaving the others alone", async () => {
    const sp = await space(owners.pro, "draft");
    const a = await insertFirst(sp.id);
    const b = await svc.createWidget(sp.id, { name: "B" });
    await svc.saveDraft(b.id, { ...defaults, template: "reel-feed" });
    expect((await svc.getWidget(sp.id, b.id))?.draftConfig).toMatchObject({ template: "reel-feed" });
    expect((await svc.getWidget(sp.id, a.id))?.draftConfig).toBeNull();
    expect(svc.widgetView((await svc.getWidget(sp.id, b.id))!, { id: sp.id, name: sp.name, embedKey: sp.embedKey }).draft?.template).toBe("reel-feed");
    await svc.discardDraft(b.id);
    expect((await svc.getWidget(sp.id, b.id))?.draftConfig).toBeNull();
  });

  it("a widget can only be reached through its own space", async () => {
    const mine = await space(owners.pro, "mine");
    const theirs = await space(owners.big, "theirs");
    const w = await insertFirst(theirs.id);
    expect(await svc.getWidget(mine.id, w.id)).toBeNull();
    expect(await svc.renameWidget(mine.id, w.id, "Hijacked")).toBeNull();
    expect(await svc.setWidgetLive(mine.id, w.id, false)).toBeNull();
    expect(await svc.deleteWidget(mine.id, w.id)).toBe("not_found");
    expect((await svc.getWidget(theirs.id, w.id))?.name).toBe("Default widget");
  });

  it("renames, switches off and on, and deletes any widget but the last", async () => {
    const sp = await space(owners.pro, "manage");
    const a = await insertFirst(sp.id);
    const b = await svc.createWidget(sp.id, { name: "B" });
    expect((await svc.renameWidget(sp.id, b.id, "Pricing page"))?.name).toBe("Pricing page");
    expect((await svc.setWidgetLive(sp.id, a.id, false))?.isLive).toBe(false);
    // The experiment target is the first widget visitors see; with none live it falls back to the first
    expect((await svc.getExperimentTarget(sp.id))?.id).toBe(a.id);
    await svc.setWidgetLive(sp.id, b.id, true);
    expect((await svc.getExperimentTarget(sp.id))?.id).toBe(b.id);

    expect(await svc.deleteWidget(sp.id, a.id)).toBe("deleted"); // the primary can go; the next becomes primary
    expect((await svc.getPrimaryWidget(sp.id))?.id).toBe(b.id);
    expect(await svc.deleteWidget(sp.id, b.id)).toBe("last");
    expect(await svc.listWidgets(sp.id)).toHaveLength(1);
  });

  it("the plan decides how many: one on free, three on pro, unlimited above", async () => {
    const freeSpace = await space(owners.free, "quota-free");
    await insertFirst(freeSpace.id);
    expect(await svc.getWidgetQuota(freeSpace.id)).toMatchObject({ allowed: false, current: 1, limit: 1 });
    const blocked = await svc.enforceWidgetLimit(freeSpace.id);
    expect(blocked?.status).toBe(403);
    expect((await blocked!.json()).error.code).toBe("PLAN_LIMIT");

    const proSpace = await space(owners.pro, "quota-pro");
    await insertFirst(proSpace.id);
    expect((await svc.getWidgetQuota(proSpace.id))?.allowed).toBe(true);
    await svc.createWidget(proSpace.id, { name: "2" });
    await svc.createWidget(proSpace.id, { name: "3" });
    expect(await svc.getWidgetQuota(proSpace.id)).toMatchObject({ allowed: false, current: 3, limit: 3 });
    expect(await svc.enforceWidgetLimit(proSpace.id)).not.toBeNull();

    const bigSpace = await space(owners.big, "quota-big");
    await insertFirst(bigSpace.id);
    for (let i = 0; i < 5; i++) await svc.createWidget(bigSpace.id, { name: `w${i}` });
    expect(await svc.enforceWidgetLimit(bigSpace.id)).toBeNull();
    expect(await svc.getWidgetQuota("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("after a downgrade, widgets over the limit keep working; only adding another is refused", async () => {
    const sp = await space(owners.free, "downgraded");
    await insertFirst(sp.id);
    await db.insert(s.widgetConfigs).values({ spaceId: sp.id, ...defaults, name: "Extra", sortOrder: 1, isLive: true });
    expect((await svc.getLiveWidgets(sp.id)).length).toBe(2); // both still shown to visitors
    expect((await svc.getWidgetQuota(sp.id))?.allowed).toBe(false);
    expect(await svc.deleteWidget(sp.id, (await svc.listWidgets(sp.id))[1].id)).toBe("deleted"); // and removable
  });

  it("deleting a space deletes its widgets", async () => {
    const sp = await space(owners.pro, "cascade");
    await insertFirst(sp.id);
    await svc.createWidget(sp.id, { name: "2" });
    await db.delete(s.spaces).where(eq(s.spaces.id, sp.id));
    expect(await svc.listWidgets(sp.id)).toEqual([]);
  });
});
