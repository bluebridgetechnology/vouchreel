import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Connect with Google" end to end against real Postgres: the connect, callback, location and disconnect routes
 * and the sync, with a stand-in for Google's servers. Skipped unless TEST_DATABASE_URL is set.
 */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const session = { user: { id: "" } as { id: string } | undefined };
vi.mock("@/lib/auth/session", () => ({ getSession: async () => (session.user ? { user: session.user } : null) }));

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/business.manage";

run("signing in with Google to read business reviews (postgres)", () => {
  type Db = typeof import("@/lib/db").db;
  let db: Db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let connect: typeof import("@/app/api/spaces/[id]/reviews/google/connect/route").POST;
  let callback: typeof import("@/app/api/reviews/google/callback/route").GET;
  let listLocations: typeof import("@/app/api/spaces/[id]/reviews/sources/[sourceId]/google-locations/route").GET;
  let chooseLocation: typeof import("@/app/api/spaces/[id]/reviews/sources/[sourceId]/google-location/route").POST;
  let disconnect: typeof import("@/app/api/spaces/[id]/reviews/sources/[sourceId]/route").DELETE;
  let sync: typeof import("../sync").syncReviewSource;
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const userId = `gflow-${Date.now()}`;
  const otherUserId = `${userId}-other`;
  let spaceId = "";

  // What the stand-in Google does, and what it was asked
  const calls: { url: string; body?: string; auth?: string }[] = [];
  let tokenError: string | null = null;
  let refreshError: string | null = null;
  let reviewPages: unknown[] = [];
  let grantedScope = GOOGLE_SCOPE;

  const fakeGoogle = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input);
    const body = init?.body ? String(init.body) : undefined;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url: u, body, auth: headers.Authorization });
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (u.startsWith("https://oauth2.googleapis.com/token")) {
      const p = new URLSearchParams(body);
      if (p.get("grant_type") === "authorization_code") {
        return tokenError ? json({ error: tokenError }, 400) : json({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, scope: `openid ${grantedScope}` });
      }
      return refreshError ? json({ error: refreshError }, 400) : json({ access_token: "at-fresh", expires_in: 3600 });
    }
    if (u.startsWith("https://oauth2.googleapis.com/revoke")) return json({});
    if (u.includes("mybusinessaccountmanagement")) return json({ accounts: [{ name: "accounts/111", accountName: "Acme" }] });
    if (u.includes("mybusinessbusinessinformation")) return json({ locations: [{ name: "locations/222", title: "Acme Cafe" }, { name: "locations/333", title: "Acme Bar" }] });
    if (u.includes("mybusiness.googleapis.com")) {
      const page = reviewPages.shift();
      return json(page ?? { reviews: [] });
    }
    throw new Error(`unexpected call to ${u}`);
  });

  const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });
  const cookieFrom = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];
  const stateFrom = (authUrl: string) => new URL(authUrl).searchParams.get("state")!;

  async function startSignIn() {
    const res = await connect(new Request("http://app.test/x", { method: "POST" }), params({ id: spaceId }));
    const body = (await res.json()) as { url: string };
    return { res, cookie: cookieFrom(res), state: stateFrom(body.url), authUrl: body.url };
  }
  const callbackReq = (qs: Record<string, string>, cookie?: string) =>
    new Request(`https://app.test/api/reviews/google/callback?${new URLSearchParams(qs)}`, { headers: cookie ? { cookie } : {} });
  const sourcesOfSpace = () => db.select().from(s.reviewSources).where(eq(s.reviewSources.spaceId, spaceId));

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    vi.stubEnv("GOOGLE_BUSINESS_CLIENT_ID", "test-client");
    vi.stubEnv("GOOGLE_BUSINESS_CLIENT_SECRET", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
    vi.stubEnv("GOOGLE_OAUTH_TEST_ORIGIN", "");
    vi.stubGlobal("fetch", fakeGoogle);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    ({ POST: connect } = await import("@/app/api/spaces/[id]/reviews/google/connect/route"));
    ({ GET: callback } = await import("@/app/api/reviews/google/callback/route"));
    ({ GET: listLocations } = await import("@/app/api/spaces/[id]/reviews/sources/[sourceId]/google-locations/route"));
    ({ POST: chooseLocation } = await import("@/app/api/spaces/[id]/reviews/sources/[sourceId]/google-location/route"));
    ({ DELETE: disconnect } = await import("@/app/api/spaces/[id]/reviews/sources/[sourceId]/route"));
    ({ syncReviewSource: sync } = await import("../sync"));
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;

    await db.insert(s.user).values([
      { id: userId, name: "GFlow", email: `${userId}@example.test` },
      { id: otherUserId, name: "Other", email: `${otherUserId}@example.test` },
    ]);
    const [space] = await db.insert(s.spaces).values({ name: "GFlow", ownerId: userId, embedKey: userId }).returning();
    spaceId = space.id;
  }, 600_000);

  beforeEach(async () => {
    session.user = { id: userId };
    calls.length = 0;
    tokenError = null;
    refreshError = null;
    reviewPages = [];
    grantedScope = GOOGLE_SCOPE;
    await db.delete(s.reviewSources).where(eq(s.reviewSources.spaceId, spaceId));
  });

  afterEach(() => fakeGoogle.mockClear());

  afterAll(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await db.delete(s.user).where(eq(s.user.id, userId));
    await db.delete(s.user).where(eq(s.user.id, otherUserId));
    await pool?.end();
    await releaseLock?.();
  });

  async function fullConnect() {
    const { cookie, state } = await startSignIn();
    const res = await callback(callbackReq({ code: "code-1", state }, cookie));
    const location = new URL(res.headers.get("location")!);
    return { res, location, sourceId: location.searchParams.get("source")! };
  }

  it("starts the sign-in: a Google address for the reviews scope, and a cookie only this browser has", async () => {
    const { res, cookie, authUrl } = await startSignIn();
    expect(res.status).toBe(200);
    const u = new URL(authUrl);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("scope")).toBe(GOOGLE_SCOPE);
    expect(u.searchParams.get("redirect_uri")).toBe("https://app.test/api/reviews/google/callback");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/vr_google_oauth=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/^vr_google_oauth=/);
  });

  it("refuses to start for someone who does not own the space, and when signed out", async () => {
    session.user = { id: otherUserId };
    expect((await connect(new Request("http://app.test/x", { method: "POST" }), params({ id: spaceId }))).status).toBe(403);
    session.user = undefined;
    expect((await connect(new Request("http://app.test/x", { method: "POST" }), params({ id: spaceId }))).status).toBe(401);
  });

  it("is off, with a clear message, when the installation has no Google app", async () => {
    vi.stubEnv("GOOGLE_BUSINESS_CLIENT_ID", "");
    try {
      const res = await connect(new Request("http://app.test/x", { method: "POST" }), params({ id: spaceId }));
      expect(res.status).toBe(400);
      expect(JSON.stringify(await res.json())).toMatch(/not set up/);
    } finally {
      vi.stubEnv("GOOGLE_BUSINESS_CLIENT_ID", "test-client");
    }
  });

  it("the callback trades the code (with the PKCE verifier), keeps the refresh token encrypted on a not-yet-active source, and sends the owner to choose a location", async () => {
    const { res, location, sourceId } = await fullConnect();
    expect(res.status).toBe(307);
    expect(location.pathname).toBe(`/spaces/${spaceId}/reviews`);
    expect(location.searchParams.get("google")).toBe("choose");
    const exchange = calls.find((c) => c.url.startsWith("https://oauth2.googleapis.com/token"))!;
    const body = new URLSearchParams(exchange.body);
    expect(body.get("code")).toBe("code-1");
    expect(body.get("code_verifier")!.length).toBeGreaterThanOrEqual(43);
    expect(body.get("client_secret")).toBe("test-secret");

    const [source] = await sourcesOfSpace();
    expect(source).toMatchObject({ id: sourceId, provider: "google", authKind: "oauth", isActive: false });
    expect(source.providerBusinessId).toMatch(/^pending:/);
    expect(JSON.stringify(source.credentials)).not.toContain("rt-1"); // encrypted at rest
    expect(res.headers.get("set-cookie")).toMatch(/vr_google_oauth=;/); // the one-time cookie is cleared
  });

  it("refuses a callback with a tampered state, a missing or wrong cookie, another user, or an expired state, and stores nothing", async () => {
    const { cookie, state } = await startSignIn();
    const expectRefused = async (req: Request) => {
      const res = await callback(req);
      expect(new URL(res.headers.get("location")!).searchParams.get("google")).toBe("error");
      expect(await sourcesOfSpace()).toHaveLength(0);
    };
    await expectRefused(callbackReq({ code: "c", state: `${state.slice(0, -3)}abc` }, cookie)); // tampered
    await expectRefused(callbackReq({ code: "c", state })); // no cookie
    await expectRefused(callbackReq({ code: "c", state }, "vr_google_oauth=wrong.verifier")); // a different browser's cookie
    session.user = { id: otherUserId };
    await expectRefused(callbackReq({ code: "c", state }, cookie)); // someone else, same link
    session.user = { id: userId };
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    try {
      await expectRefused(callbackReq({ code: "c", state }, cookie)); // too late
    } finally {
      vi.useRealTimers();
    }
    expect(calls.filter((c) => c.url.includes("/token"))).toHaveLength(0); // Google was never asked
  });

  it("reports a refusal at Google's consent screen, a missing reviews permission, and a failed exchange without storing anything", async () => {
    let { cookie, state } = await startSignIn();
    let res = await callback(callbackReq({ error: "access_denied", state }, cookie));
    expect(new URL(res.headers.get("location")!).searchParams.get("reason")).toBe("denied");

    ({ cookie, state } = await startSignIn());
    grantedScope = "openid";
    res = await callback(callbackReq({ code: "c", state }, cookie));
    expect(new URL(res.headers.get("location")!).searchParams.get("reason")).toBe("denied");

    grantedScope = GOOGLE_SCOPE;
    ({ cookie, state } = await startSignIn());
    tokenError = "invalid_grant";
    res = await callback(callbackReq({ code: "c", state }, cookie));
    expect(new URL(res.headers.get("location")!).searchParams.get("reason")).toBe("revoked");
    expect(await sourcesOfSpace()).toHaveLength(0);
  });

  it("lists only locations the account manages, and the owner picks one: it becomes active and its reviews are read", async () => {
    const { sourceId } = await fullConnect();
    const listed = await listLocations(new Request("http://app.test/x"), params({ id: spaceId, sourceId }));
    expect(((await listed.json()) as { locations: { id: string; title: string }[] }).locations.map((l) => [l.id, l.title])).toEqual([
      ["accounts/111/locations/222", "Acme Cafe"],
      ["accounts/111/locations/333", "Acme Bar"],
    ]);

    // someone cannot pick a location the account does not manage
    const bad = await chooseLocation(
      new Request("http://app.test/x", { method: "POST", body: JSON.stringify({ locationId: "accounts/999/locations/1" }) }),
      params({ id: spaceId, sourceId })
    );
    expect(bad.status).toBe(400);
    expect((await sourcesOfSpace())[0].isActive).toBe(false);

    reviewPages = [
      {
        reviews: [
          { reviewId: "r1", reviewer: { displayName: "Ada" }, starRating: "FIVE", comment: "Brilliant coffee and lovely staff.", createTime: "2026-02-01T09:00:00Z" },
          { reviewId: "r2", reviewer: { displayName: "Bo" }, starRating: "FOUR", comment: "Good.", createTime: "2026-02-02T09:00:00Z" },
        ],
        averageRating: 4.7,
        totalReviewCount: 120,
      },
    ];
    const ok = await chooseLocation(
      new Request("http://app.test/x", { method: "POST", body: JSON.stringify({ locationId: "accounts/111/locations/222" }) }),
      params({ id: spaceId, sourceId })
    );
    expect(ok.status).toBe(200);
    const [source] = await sourcesOfSpace();
    expect(source).toMatchObject({ isActive: true, providerBusinessId: "accounts/111/locations/222", displayName: "Acme Cafe", ratingAverage: 4.7, ratingTotal: 120, lastError: null });
    const imported = await db.select().from(s.reviews).where(eq(s.reviews.sourceId, sourceId));
    expect(imported.map((r) => [r.authorName, r.rating, r.text]).sort()).toEqual([
      ["Ada", 5, "Brilliant coffee and lovely staff."],
      ["Bo", 4, "Good."],
    ]);
    expect(imported.every((r) => r.textFetchedAt !== null)).toBe(true);
    // The review calls carried the owner's fresh access token, not our app's secret
    const reviewCall = calls.find((c) => c.url.includes("mybusiness.googleapis.com"))!;
    expect(reviewCall.auth).toBe("Bearer at-fresh");
  });

  it("another user cannot list or choose locations for this space's source", async () => {
    const { sourceId } = await fullConnect();
    session.user = { id: otherUserId };
    expect((await listLocations(new Request("http://app.test/x"), params({ id: spaceId, sourceId }))).status).toBe(403);
    expect((await chooseLocation(new Request("http://app.test/x", { method: "POST", body: "{}" }), params({ id: spaceId, sourceId }))).status).toBe(403);
  });

  it("a second sign-in for a space that already has a Google source is refused, and an unfinished earlier attempt is replaced", async () => {
    const first = await fullConnect(); // unfinished (still pending)
    const second = await fullConnect(); // replaces it
    expect(second.sourceId).not.toBe(first.sourceId);
    expect(await sourcesOfSpace()).toHaveLength(1);

    await db.update(s.reviewSources).set({ providerBusinessId: "accounts/1/locations/2", isActive: true }).where(eq(s.reviewSources.id, second.sourceId));
    const { cookie, state } = await startSignIn();
    const res = await callback(callbackReq({ code: "c", state }, cookie));
    expect(new URL(res.headers.get("location")!).searchParams.get("reason")).toBe("already_connected");
    expect(await sourcesOfSpace()).toHaveLength(1);
  });

  it("when Google access is withdrawn, the source says so and the sync fails clearly instead of silently", async () => {
    const { sourceId } = await fullConnect();
    await db.update(s.reviewSources).set({ providerBusinessId: "accounts/111/locations/222", isActive: true, lastSyncAt: null }).where(eq(s.reviewSources.id, sourceId));
    refreshError = "invalid_grant";
    await expect(sync(sourceId, { force: true })).rejects.toThrow(/withdrawn or has expired/);
    expect((await sourcesOfSpace())[0].lastError).toMatch(/withdrawn or has expired/);

    // a later good sync clears it
    refreshError = null;
    reviewPages = [{ reviews: [], averageRating: 4, totalReviewCount: 3 }];
    await sync(sourceId, { force: true });
    expect((await sourcesOfSpace())[0].lastError).toBeNull();
  });

  it("disconnecting tells Google to forget the access, deletes the source and its reviews, and still works when Google is unreachable", async () => {
    const { sourceId } = await fullConnect();
    await db.update(s.reviewSources).set({ providerBusinessId: "accounts/111/locations/222", isActive: true }).where(eq(s.reviewSources.id, sourceId));
    await db.insert(s.reviews).values({ spaceId, sourceId, provider: "google", providerReviewId: `${userId}-r`, authorName: "A", rating: 5, text: "x" });
    const res = await disconnect(new Request("http://app.test/x", { method: "DELETE" }), params({ id: spaceId, sourceId }));
    expect(res.status).toBe(200);
    const revoke = calls.find((c) => c.url.startsWith("https://oauth2.googleapis.com/revoke"))!;
    expect(new URLSearchParams(revoke.body).get("token")).toBe("rt-1");
    expect(await sourcesOfSpace()).toHaveLength(0);
    expect(await db.select().from(s.reviews).where(eq(s.reviews.sourceId, sourceId))).toHaveLength(0);

    // unreachable Google
    const again = await fullConnect();
    fakeGoogle.mockImplementationOnce(async () => {
      throw new Error("offline");
    });
    const res2 = await disconnect(new Request("http://app.test/x", { method: "DELETE" }), params({ id: spaceId, sourceId: again.sourceId }));
    expect(res2.status).toBe(200);
    expect(await sourcesOfSpace()).toHaveLength(0);
  });
});
