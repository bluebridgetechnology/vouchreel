import { describe, expect, it, vi } from "vitest";
import {
  GOOGLE_BUSINESS_SCOPE,
  GoogleAuthError,
  buildAuthUrl,
  exchangeCode,
  googleEndpoints,
  googleOAuthConfig,
  newPkce,
  refreshAccessToken,
  revokeToken,
  signState,
  verifyState,
} from "../google-oauth";
import crypto from "crypto";

const config = { clientId: "cid", clientSecret: "csecret", redirectUri: "https://app.example/api/reviews/google/callback" };
const secret = "test-secret";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("the OAuth app's configuration", () => {
  it("is off unless both the client id and secret are set, and builds the callback address from the app's address", () => {
    expect(googleOAuthConfig({})).toBeNull();
    expect(googleOAuthConfig({ GOOGLE_BUSINESS_CLIENT_ID: "a", NEXT_PUBLIC_APP_URL: "https://x.test" })).toBeNull();
    expect(googleOAuthConfig({ GOOGLE_BUSINESS_CLIENT_ID: "a", GOOGLE_BUSINESS_CLIENT_SECRET: "b" })).toBeNull(); // no address to come back to
    expect(googleOAuthConfig({ GOOGLE_BUSINESS_CLIENT_ID: " a ", GOOGLE_BUSINESS_CLIENT_SECRET: "b", NEXT_PUBLIC_APP_URL: "https://x.test/" })).toEqual({
      clientId: "a",
      clientSecret: "b",
      redirectUri: "https://x.test/api/reviews/google/callback",
    });
  });
});

describe("the signed state", () => {
  const state = { spaceId: "s1", userId: "u1", nonce: "n1", exp: 2_000_000 };

  it("round-trips while it is fresh", () => {
    expect(verifyState(signState(state, secret), 1_000_000, secret)).toEqual(state);
  });

  it("is refused once expired", () => {
    expect(verifyState(signState(state, secret), 2_000_001, secret)).toBeNull();
  });

  it("is refused when any part was changed, signed with another secret, or malformed", () => {
    const token = signState(state, secret);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...state, userId: "attacker" })).toString("base64url");
    expect(verifyState(`${forged}.${sig}`, 1, secret)).toBeNull();
    expect(verifyState(`${body}.${sig.slice(0, -2)}xx`, 1, secret)).toBeNull();
    expect(verifyState(token, 1, "another-secret")).toBeNull();
    expect(verifyState(`${token}.extra`, 1, secret)).toBeNull();
    expect(verifyState("nonsense", 1, secret)).toBeNull();
    expect(verifyState("", 1, secret)).toBeNull();
    expect(verifyState(null, 1, secret)).toBeNull();
  });
});

describe("PKCE and the sign-in address", () => {
  it("the challenge is the S256 hash of the verifier, and every pair is new", () => {
    const a = newPkce();
    expect(a.challenge).toBe(crypto.createHash("sha256").update(a.verifier).digest("base64url"));
    expect(newPkce().verifier).not.toBe(a.verifier);
    expect(a.verifier.length).toBeGreaterThanOrEqual(43);
  });

  it("asks for the reviews scope only, offline, with the state and PKCE", () => {
    const url = new URL(buildAuthUrl(config, { state: "STATE", challenge: "CHAL" }, {}));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_BUSINESS_SCOPE);
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("STATE");
    expect(url.searchParams.get("code_challenge")).toBe("CHAL");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.search).not.toContain("csecret"); // the secret never goes through the browser
  });

  it("can be pointed at a test server, and only by that setting", () => {
    expect(googleEndpoints({}).token).toBe("https://oauth2.googleapis.com/token");
    const t = googleEndpoints({ GOOGLE_OAUTH_TEST_ORIGIN: "http://127.0.0.1:9/" });
    expect(t.token).toBe("http://127.0.0.1:9/token");
    expect(t.reviews("accounts/1/locations/2")).toBe("http://127.0.0.1:9/accounts/1/locations/2/reviews");
  });
});

describe("trading the code and refreshing", () => {
  it("sends the code with the PKCE verifier and the app's secret, and returns the refresh token", async () => {
    const fetchImpl = vi.fn(async () => json({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: `openid ${GOOGLE_BUSINESS_SCOPE}` }));
    const out = await exchangeCode(config, { code: "CODE", verifier: "VER" }, fetchImpl as never, {});
    expect(out).toMatchObject({ refreshToken: "rt", accessToken: "at" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toMatchObject({ grant_type: "authorization_code", code: "CODE", code_verifier: "VER", client_id: "cid", client_secret: "csecret", redirect_uri: config.redirectUri });
  });

  it("refuses when the owner did not tick the reviews permission", async () => {
    const fetchImpl = vi.fn(async () => json({ access_token: "at", refresh_token: "rt", scope: "openid" }));
    await expect(exchangeCode(config, { code: "c", verifier: "v" }, fetchImpl as never, {})).rejects.toMatchObject({ kind: "denied" });
  });

  it("refuses a response without a refresh token (we could never read again)", async () => {
    const fetchImpl = vi.fn(async () => json({ access_token: "at", scope: GOOGLE_BUSINESS_SCOPE }));
    await expect(exchangeCode(config, { code: "c", verifier: "v" }, fetchImpl as never, {})).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it("reports a withdrawn grant as revoked, and anything else as a failure", async () => {
    await expect(refreshAccessToken(config, "rt", (async () => json({ error: "invalid_grant" }, 400)) as never, {})).rejects.toMatchObject({ kind: "revoked" });
    await expect(refreshAccessToken(config, "rt", (async () => json({ error: "server_error" }, 500)) as never, {})).rejects.toMatchObject({ kind: "failed" });
    await expect(refreshAccessToken(config, "rt", (async () => json({ access_token: "fresh" })) as never, {})).resolves.toBe("fresh");
  });

  it("revoking never throws, even when Google is unreachable", async () => {
    expect(await revokeToken("rt", (async () => json({}, 200)) as never, {})).toBe(true);
    expect(await revokeToken("rt", (async () => json({}, 400)) as never, {})).toBe(false);
    expect(await revokeToken("rt", (async () => { throw new Error("offline"); }) as never, {})).toBe(false);
  });
});
