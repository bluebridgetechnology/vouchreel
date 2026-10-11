import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set: TEST_DATABASE_URL=postgres://... npm test -w apps/dashboard */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const session = vi.hoisted(() => ({ userId: "" }));
const limiter = vi.hoisted(() => ({ success: true }));
const page = vi.hoisted(() => ({ html: "" }));

vi.mock("@/lib/ai-video/access", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireSpaceOwner: vi.fn(async (spaceId: string) => {
      const { db } = await import("@/lib/db");
      const { spaces } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      const [row] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
      if (!row || row.ownerId !== session.userId) return { response: NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 }) };
      return { userId: session.userId };
    }),
  };
});
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ success: limiter.success, remaining: 1, reset: Date.now() + 30_000 })) }));
vi.mock("@/lib/security/ssrf", async (orig) => ({
  ...(await orig<typeof import("@/lib/security/ssrf")>()),
  safeFetch: vi.fn(async () => new Response(page.html, { status: 200, headers: { "content-type": "text/html" } })),
}));

run("install status and check (postgres)", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let status: typeof import("../status");
  let statusRoute: typeof import("@/app/api/spaces/[id]/install/status/route");
  let checkRoute: typeof import("@/app/api/spaces/[id]/install/check/route");
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `in${Date.now()}`;
  const owner = `${tag}-owner`;
  const stranger = `${tag}-stranger`;
  const now = new Date("2026-10-09T12:00:00Z");
  const at = (iso: string) => new Date(iso);
  let space = "";
  let hero = "";
  let wall = "";

  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const getStatus = (id: string, query = "") => statusRoute.GET(new Request(`http://x/api/spaces/${id}/install/status${query}`), params(id));
  const postCheck = (id: string, body: unknown) =>
    checkRoute.POST(new Request(`http://x/api/spaces/${id}/install/check`, { method: "POST", body: JSON.stringify(body) }), params(id));

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    status = await import("../status");
    statusRoute = await import("@/app/api/spaces/[id]/install/status/route");
    checkRoute = await import("@/app/api/spaces/[id]/install/check/route");

    await db.insert(s.user).values([
      { id: owner, name: owner, email: `${owner}@example.test` },
      { id: stranger, name: stranger, email: `${stranger}@example.test` },
    ]);
    space = (await db.insert(s.spaces).values({ name: `${tag} one`, ownerId: owner, embedKey: `${tag}-key` }).returning())[0].id;
    hero = (await db.insert(s.widgetConfigs).values({ spaceId: space, name: "Hero", sortOrder: 0 }).returning())[0].id;
    wall = (await db.insert(s.widgetConfigs).values({ spaceId: space, name: "Wall", sortOrder: 1, template: "wall-of-love" }).returning())[0].id;

    const ev = (widgetId: string | null, ts: string, pageUrl: string | null, eventType: "impression" | "play" = "impression") => ({
      spaceId: space, widgetId, eventType, timestamp: at(ts), sessionId: "s", pageUrl,
    });
    await db.insert(s.events).values([
      ev(hero, "2026-10-09T11:00:00Z", "https://Shop.Acme.com/pricing?email=a@b.c"),
      ev(hero, "2026-10-09T10:00:00Z", "https://shop.acme.com/"),
      ev(wall, "2026-10-08T10:00:00Z", "https://blog.acme.com/post"),
      ev(hero, "2026-10-09T09:00:00Z", "https://shop.acme.com/", "play"), // not a view
      ev(hero, "2026-10-09T09:00:00Z", null), // no page
      ev(hero, "2026-08-01T09:00:00Z", "https://old.acme.com/"), // outside the window
      ev(hero, "2026-10-09T08:00:00Z", "https://user:pw@creds.acme.com/x"),
    ]);
  }, 600_000);

  afterAll(async () => {
    if (db) {
      await db.delete(s.spaces).where(eq(s.spaces.id, space));
      await db.delete(s.user).where(eq(s.user.id, owner));
      await db.delete(s.user).where(eq(s.user.id, stranger));
    }
    await releaseLock?.();
  }, 60_000);

  it("groups views by site, newest first, with the host only and no credentials", async () => {
    const seen = await status.getSeenOn(space, { now });
    expect(seen.map((r) => r.host)).toEqual(["shop.acme.com", "creds.acme.com", "blog.acme.com"]);
    expect(seen[0]).toMatchObject({ views: 2, lastSeen: "2026-10-09T11:00:00.000Z" });
    expect(JSON.stringify(seen)).not.toMatch(/email|pw|pricing/);
  });

  it("can look at one widget, and at a shorter window or list", async () => {
    expect((await status.getSeenOn(space, { widgetId: wall, now })).map((r) => r.host)).toEqual(["blog.acme.com"]);
    expect((await status.getSeenOn(space, { now, days: 100 })).map((r) => r.host)).toContain("old.acme.com");
    expect(await status.getSeenOn(space, { now, limit: 1 })).toHaveLength(1);
    expect(await status.getSeenOn("00000000-0000-4000-8000-000000000000", { now })).toEqual([]);
  });

  describe("routes", () => {
    it("status: owner only, unknown widget is 404, bad id is 400", async () => {
      session.userId = stranger;
      expect((await getStatus(space)).status).toBe(404);
      session.userId = owner;
      const ok = await getStatus(space);
      expect(ok.status).toBe(200);
      expect(Array.isArray((await ok.json()).seen)).toBe(true);
      expect((await getStatus(space, `?widgetId=${hero}`)).status).toBe(200);
      expect((await getStatus(space, "?widgetId=00000000-0000-4000-8000-00000000dead")).status).toBe(404);
      expect((await getStatus(space, "?widgetId=nope")).status).toBe(400);
    });

    it("check: owner only, validates, rate limits, and asks for the spot only of an inline widget", async () => {
      const script = `<script async src="https://app.test/widget/${tag}-key.js" data-key="${tag}-key"></script>`;
      page.html = `<html><body>${script}</body></html>`;

      session.userId = stranger;
      expect((await postCheck(space, { url: "acme.com" })).status).toBe(404);
      session.userId = owner;

      expect((await postCheck(space, { url: "x".repeat(3000) })).status).toBe(400);
      expect((await postCheck(space, { url: "acme.com", widgetId: "nope" })).status).toBe(400);
      expect((await postCheck(space, { url: "acme.com", widgetId: "00000000-0000-4000-8000-00000000dead" })).status).toBe(404);

      const floating = await (await postCheck(space, { url: "acme.com", widgetId: hero })).json();
      expect(floating.lines).toEqual([{ ok: true, text: "The Vouchreel script is on this page." }]);
      const inline = await (await postCheck(space, { url: "acme.com", widgetId: wall })).json();
      expect(inline.lines[1]).toMatchObject({ ok: false });

      limiter.success = false;
      const limited = await postCheck(space, { url: "acme.com" });
      limiter.success = true;
      expect(limited.status).toBe(429);
      expect(limited.headers.get("Retry-After")).toBeTruthy();
    });
  });
});
