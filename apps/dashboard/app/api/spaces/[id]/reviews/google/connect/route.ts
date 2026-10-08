import { NextResponse } from "next/server";
import crypto from "crypto";
import { badRequest, forbidden, internalError, notFound, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { buildAuthUrl, googleOAuthConfig, newPkce, signState } from "@/lib/reviews/google-oauth";
import { spaceAccess } from "@/lib/reviews/owner";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const OAUTH_COOKIE = "vr_google_oauth";
const TEN_MINUTES = 10 * 60;

/**
 * POST /api/spaces/[id]/reviews/google/connect
 * Starts "Connect with Google": returns the Google address to send the owner to. The browser keeps a one-time
 * value (and the PKCE secret) in a short-lived cookie that the callback checks, so the sign-in can only be
 * finished by the browser that started it.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  const { id: spaceId } = await params;

  try {
    const access = await spaceAccess(spaceId, session.user.id);
    if (access === "missing") return notFound("Space not found");
    if (access === "forbidden") return forbidden("Forbidden: You do not own this space");
    const config = googleOAuthConfig();
    if (!config) return badRequest("Signing in with Google is not set up on this installation. Use your own Google API key instead.");

    const nonce = crypto.randomBytes(16).toString("base64url");
    const { verifier, challenge } = newPkce();
    const state = signState({ spaceId, userId: session.user.id, nonce, exp: Date.now() + TEN_MINUTES * 1000 });

    const response = NextResponse.json({ url: buildAuthUrl(config, { state, challenge }) });
    response.cookies.set(OAUTH_COOKIE, `${nonce}.${verifier}`, {
      httpOnly: true,
      // Secure whenever the app is served over https (it always is in production); plain http only in local testing
      secure: config.redirectUri.startsWith("https:"),
      // Lax: the cookie must come back when Google sends the browser to our callback
      sameSite: "lax",
      path: "/api/reviews/google",
      maxAge: TEN_MINUTES,
    });
    return response;
  } catch (error) {
    log.error("Could not start the Google sign-in:", error);
    return internalError("Could not start the Google sign-in");
  }
}
