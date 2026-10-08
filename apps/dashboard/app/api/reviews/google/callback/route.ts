import { NextResponse } from "next/server";
import { and, eq, like } from "drizzle-orm";
import crypto from "crypto";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reviewSources } from "@/lib/db/schema";
import { encryptCredentials } from "@/lib/reviews/crypto";
import { exchangeCode, GoogleAuthError, googleOAuthConfig, verifyState } from "@/lib/reviews/google-oauth";
import { spaceAccess } from "@/lib/reviews/owner";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const OAUTH_COOKIE = "vr_google_oauth";

/**
 * GET /api/reviews/google/callback
 * Where Google sends the owner back. Checks that this is the browser and the person who started the sign-in,
 * trades the code for tokens, keeps the refresh token (encrypted) on a new, not yet active review source, and
 * sends the owner on to choose which business location to use.
 */
export async function GET(request: Request) {
  const config = googleOAuthConfig();
  const origin = config ? new URL(config.redirectUri).origin : new URL(request.url).origin;
  const back = (spaceId: string | null, query: Record<string, string>) => {
    const path = spaceId ? `/spaces/${spaceId}/reviews` : "/spaces";
    const url = new URL(path, origin);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const response = NextResponse.redirect(url);
    response.cookies.set(OAUTH_COOKIE, "", { path: "/api/reviews/google", maxAge: 0 });
    return response;
  };

  const params = new URL(request.url).searchParams;
  const state = verifyState(params.get("state"));
  // Without a valid state we do not know which space this was for, so there is nowhere meaningful to send them
  if (!state) return back(null, { google: "error", reason: "invalid" });

  if (params.get("error")) return back(state.spaceId, { google: "error", reason: params.get("error") === "access_denied" ? "denied" : "failed" });
  if (!config) return back(state.spaceId, { google: "error", reason: "not_configured" });

  const session = await getSession();
  if (!session?.user?.id || session.user.id !== state.userId) return back(state.spaceId, { google: "error", reason: "invalid" });
  if ((await spaceAccess(state.spaceId, session.user.id)) !== "ok") return back(state.spaceId, { google: "error", reason: "invalid" });

  // The cookie the connect step set: "<nonce>.<pkce verifier>"
  const cookie = request.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${OAUTH_COOKIE}=`))?.slice(OAUTH_COOKIE.length + 1);
  const [nonce, verifier] = (cookie ?? "").split(".");
  const nonceOk = Boolean(nonce) && nonce.length === state.nonce.length && crypto.timingSafeEqual(Buffer.from(nonce), Buffer.from(state.nonce));
  const code = params.get("code");
  if (!nonceOk || !verifier || !code) return back(state.spaceId, { google: "error", reason: "invalid" });

  try {
    const tokens = await exchangeCode(config, { code, verifier });

    // One Google source per space; leftovers of an unfinished earlier attempt are replaced
    const existing = await db.select().from(reviewSources).where(and(eq(reviewSources.spaceId, state.spaceId), eq(reviewSources.provider, "google")));
    if (existing.some((s) => !s.providerBusinessId.startsWith("pending:"))) return back(state.spaceId, { google: "error", reason: "already_connected" });
    await db.delete(reviewSources).where(and(eq(reviewSources.spaceId, state.spaceId), eq(reviewSources.provider, "google"), like(reviewSources.providerBusinessId, "pending:%")));

    const [source] = await db
      .insert(reviewSources)
      .values({
        spaceId: state.spaceId,
        provider: "google",
        providerBusinessId: `pending:${crypto.randomUUID()}`,
        authKind: "oauth",
        credentials: encryptCredentials({ kind: "oauth", refreshToken: tokens.refreshToken }),
        isActive: false, // becomes active once a location is chosen
      })
      .returning({ id: reviewSources.id });
    return back(state.spaceId, { google: "choose", source: source.id });
  } catch (error) {
    if (error instanceof GoogleAuthError) return back(state.spaceId, { google: "error", reason: error.kind });
    log.error("Google sign-in callback failed:", error);
    return back(state.spaceId, { google: "error", reason: "failed" });
  }
}
