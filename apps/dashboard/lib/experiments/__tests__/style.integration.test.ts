import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(async () => (session.userId ? { user: { id: session.userId } } : null)) }));

run("style experiments (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let createRoute: typeof import("@/app/api/spaces/[id]/experiments/route");
  let applyRoute: typeof import("@/app/api/spaces/[id]/experiments/[expId]/apply-winner/route");
  let publicRoute: typeof import("@/app/api/widget/[embedKey]/route");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `se${Date.now()}`;
  const owner = `${tag}-owner`;
  let space = "";
  let widget = "";

  const create = (body: unknown) =>
    createRoute.POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: space }) });
  const start = (expId: string) => db.update(s.experiments).set({ status: "running", startedAt: new Date() }).where(eq(s.experiments.id, expId));
  const publicData = async () => (await (await publicRoute.GET(new Request("http://x"), { params: Promise.resolve({ embedKey: `${tag}-key` }) })).json());
  const row = async () => (await db.select().from(s.widgetConfigs).where(eq(s.widgetConfigs.id, widget)))[0];

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    createRoute = await import("@/app/api/spaces/[id]/experiments/route");
    applyRoute = await import("@/app/api/spaces/[id]/experiments/[expId]/apply-winner/route");
    publicRoute = await import("@/app/api/widget/[embedKey]/route");

    await db.insert(s.user).values({ id: owner, name: owner, email: `${owner}@example.test` });
    space = (await db.insert(s.spaces).values({ name: `${tag} Acme`, ownerId: owner, embedKey: `${tag}-key` }).returning())[0].id;
    widget = (
      await db
        .insert(s.widgetConfigs)
        .values({ spaceId: space, name: "Wall", template: "wall-of-love", theme: { primaryColor: "#123456", accentColor: "#ffffff", mode: "light", borderRadius: 12, showName: false, shape: "circle" } })
        .returning()
    )[0].id;
    session.userId = owner;
  }, 600_000);

  afterAll(async () => {
    if (db) {
      await db.delete(s.spaces).where(eq(s.spaces.id, space));
      await db.delete(s.user).where(eq(s.user.id, owner));
    }
    await releaseLock?.();
  }, 60_000);

  const variants = [
    { id: "a", name: "Current look", config: {} },
    { id: "b", name: "Dark cinema, Carousel", config: { preset: "cinema", template: "carousel" } },
  ];
  let expId = "";

  it("is created with a layout and/or look per variant, and refuses a made-up theme", async () => {
    const bad = await create({ name: "Bad", type: "style", variants: [variants[0], { id: "b", name: "B", config: { theme: { primaryColor: "#ff0000" }, template: "carousel" } }], trafficSplit: [50, 50] });
    expect(bad.status).toBe(400);
    const res = await create({ name: "Looks", type: "style", variants, trafficSplit: [50, 50] });
    expect(res.status).toBe(201);
    expId = (await res.json()).experiment.id;
    expect(expId).toBeTruthy();
  });

  it("the public data gives each variant a complete layout and theme built on the live widget, with only those keys", async () => {
    await start(expId);
    const { activeExperiment, config } = await publicData();
    expect(activeExperiment.type).toBe("style");
    const [a, b] = activeExperiment.variants;
    expect(a.config).toMatchObject({ template: "wall-of-love", theme: { primaryColor: "#123456", showName: false, shape: "circle" } });
    expect(b.config).toMatchObject({ template: "carousel", theme: { mode: "dark", background: "#0c0a09", primaryColor: "#123456", showName: false, shape: null } });
    expect(Object.keys(b.config).sort()).toEqual(["template", "theme"]); // nothing else can reach the widget's settings
    expect(config.template).toBe("wall-of-love"); // the widget itself is unchanged for anyone not in the test
  });

  it("stored junk in a variant cannot get through to the widget", async () => {
    await db
      .update(s.experiments)
      .set({ variants: [variants[0], { id: "b", name: "B", config: { template: "carousel", id: "evil", trigger: { type: "delay" }, theme: { primaryColor: "#ff0000" } } }] })
      .where(eq(s.experiments.id, expId));
    const { activeExperiment } = await publicData();
    const config = activeExperiment.variants[1].config;
    expect(Object.keys(config).sort()).toEqual(["template", "theme"]);
    expect(config.template).toBe("wall-of-love"); // an invalid config means "no change"
    expect(config.theme.primaryColor).toBe("#123456");
    await db.update(s.experiments).set({ variants }).where(eq(s.experiments.id, expId));
  });

  it("follows edits made to the widget while the test runs", async () => {
    await db.update(s.widgetConfigs).set({ theme: { primaryColor: "#abcdef", accentColor: "#ffffff", mode: "light", borderRadius: 12 } }).where(eq(s.widgetConfigs.id, widget));
    const { activeExperiment } = await publicData();
    expect(activeExperiment.variants[1].config.theme.primaryColor).toBe("#abcdef");
  });

  it("applying the winner puts its layout and look on the widget and completes the test", async () => {
    const res = await applyRoute.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ variantId: "b" }) }), { params: Promise.resolve({ id: space, expId }) });
    expect(res.status).toBe(200);
    const saved = await row();
    expect(saved.template).toBe("carousel");
    expect(saved.theme).toMatchObject({ mode: "dark", background: "#0c0a09", primaryColor: "#abcdef" });
    const [exp] = await db.select().from(s.experiments).where(eq(s.experiments.id, expId));
    expect(exp).toMatchObject({ status: "completed", winnerVariantIndex: 1 });
  });
});
