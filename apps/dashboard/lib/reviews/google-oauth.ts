import crypto from "crypto";
import { encryptionSecret } from "./crypto";

/**
 * Letting an owner sign in with Google so we can read their own Business Profile reviews.
 * The platform registers one OAuth app (a client id and secret, GOOGLE_BUSINESS_CLIENT_ID and
 * GOOGLE_BUSINESS_CLIENT_SECRET); each owner then authorises it for their own business. Nothing here is a
 * billed API key of ours. Without those two variables the feature is off and owners use their own API key.
 *
 * Scope: business.manage, the only scope Google offers for reading Business Profile reviews. It also lets an app
 * edit the profile, which we never do; the consent screen says so, and the privacy text should too.
 */

export const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";

/** Where each Google call goes. GOOGLE_OAUTH_TEST_ORIGIN points all of them at a fake server in the browser tests. */
export function googleEndpoints(env: Record<string, string | undefined> = process.env) {
  const test = env.GOOGLE_OAUTH_TEST_ORIGIN?.replace(/\/$/, "");
  if (test) {
    return {
      authorize: `${test}/authorize`,
      token: `${test}/token`,
      revoke: `${test}/revoke`,
      accounts: `${test}/accounts`,
      locations: (account: string) => `${test}/${account}/locations`,
      reviews: (location: string) => `${test}/${location}/reviews`,
    };
  }
  return {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    revoke: "https://oauth2.googleapis.com/revoke",
    accounts: "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    locations: (account: string) => `https://mybusinessbusinessinformation.googleapis.com/v1/${account}/locations`,
    reviews: (location: string) => `https://mybusiness.googleapis.com/v4/${location}/reviews`,
  };
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** The app's credentials, or null when this installation has not set up Google sign-in for review sources. */
export function googleOAuthConfig(env: Record<string, string | undefined> = process.env): GoogleOAuthConfig | null {
  const clientId = env.GOOGLE_BUSINESS_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim();
  const origin = (env.NEXT_PUBLIC_APP_URL || env.BETTER_AUTH_URL || "").replace(/\/$/, "");
  if (!clientId || !clientSecret || !origin) return null;
  return { clientId, clientSecret, redirectUri: `${origin}/api/reviews/google/callback` };
}

// ---- state: what the callback needs to know, signed so it cannot be forged or replayed for someone else ----

export interface OAuthState {
  spaceId: string;
  userId: string;
  /** Matches the value in the browser's cookie, so a state copied to another browser is useless. */
  nonce: string;
  /** Expiry, ms since epoch. */
  exp: number;
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function stateKey(secret = encryptionSecret()): Buffer {
  return crypto.createHmac("sha256", secret).update("google-oauth-state").digest();
}

export function signState(state: OAuthState, secret?: string): string {
  const body = b64url(JSON.stringify(state));
  const sig = crypto.createHmac("sha256", stateKey(secret)).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(token: string | null | undefined, now = Date.now(), secret?: string): OAuthState | null {
  if (!token) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = crypto.createHmac("sha256", stateKey(secret)).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const state = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    if (typeof state.spaceId !== "string" || typeof state.userId !== "string" || typeof state.nonce !== "string") return null;
    if (typeof state.exp !== "number" || state.exp < now) return null;
    return state;
  } catch {
    return null;
  }
}

// ---- PKCE: the code only works for the browser that started the sign-in ----

export function newPkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthUrl(config: GoogleOAuthConfig, input: { state: string; challenge: string }, env: Record<string, string | undefined> = process.env): string {
  const url = new URL(googleEndpoints(env).authorize);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_BUSINESS_SCOPE);
  // offline + consent: Google only returns a refresh token on the first consent, so ask every time
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

// ---- tokens ----

type Fetch = typeof fetch;

export class GoogleAuthError extends Error {
  constructor(message: string, readonly kind: "revoked" | "denied" | "failed") {
    super(message);
    this.name = "GoogleAuthError";
  }
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function postToken(params: Record<string, string>, fetchImpl: Fetch, env: Record<string, string | undefined> = process.env): Promise<TokenResponse> {
  const res = await fetchImpl(googleEndpoints(env).token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || data.error) {
    // invalid_grant: the owner removed our access, or the refresh token expired or was revoked
    const revoked = data.error === "invalid_grant";
    throw new GoogleAuthError(
      revoked ? "Google access was withdrawn or has expired. Connect Google again." : `Google sign-in failed (${data.error ?? res.status}).`,
      revoked ? "revoked" : "failed"
    );
  }
  return data;
}

/** Trades the code Google sent back for tokens. Needs the PKCE verifier from the browser that started the sign-in. */
export async function exchangeCode(
  config: GoogleOAuthConfig,
  input: { code: string; verifier: string },
  fetchImpl: Fetch = fetch,
  env: Record<string, string | undefined> = process.env
): Promise<{ refreshToken: string; accessToken: string; scope: string }> {
  const data = await postToken(
    {
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: input.verifier,
    },
    fetchImpl,
    env
  );
  if (!data.refresh_token || !data.access_token) throw new GoogleAuthError("Google did not return the access we asked for.", "failed");
  if (!(data.scope ?? "").split(/\s+/).includes(GOOGLE_BUSINESS_SCOPE)) {
    throw new GoogleAuthError("Google access to your business reviews was not granted. Tick the permission when asked.", "denied");
  }
  return { refreshToken: data.refresh_token, accessToken: data.access_token, scope: data.scope ?? "" };
}

/** A fresh access token from the stored refresh token. Access tokens are short-lived and never stored. */
export async function refreshAccessToken(config: GoogleOAuthConfig, refreshToken: string, fetchImpl: Fetch = fetch, env: Record<string, string | undefined> = process.env): Promise<string> {
  const data = await postToken(
    { grant_type: "refresh_token", refresh_token: refreshToken, client_id: config.clientId, client_secret: config.clientSecret },
    fetchImpl,
    env
  );
  if (!data.access_token) throw new GoogleAuthError("Google did not return an access token.", "failed");
  return data.access_token;
}

/** Tells Google to forget the grant. Best effort: disconnecting must work even when Google is unreachable. */
export async function revokeToken(token: string, fetchImpl: Fetch = fetch, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  try {
    const res = await fetchImpl(googleEndpoints(env).revoke, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
