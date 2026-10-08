import { NextResponse } from "next/server";
import { badRequest, forbidden, internalError, notFound, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { decryptCredentials } from "@/lib/reviews/crypto";
import { GoogleApiError, listBusinessLocations } from "@/lib/reviews/google-business";
import { GoogleAuthError, googleOAuthConfig, refreshAccessToken } from "@/lib/reviews/google-oauth";
import { spaceAccess, spaceSource } from "@/lib/reviews/owner";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string; sourceId: string }>;
}

/**
 * GET /api/spaces/[id]/reviews/sources/[sourceId]/google-locations
 * The business locations the owner's Google account manages, to choose from after signing in.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  const { id: spaceId, sourceId } = await params;

  try {
    const access = await spaceAccess(spaceId, session.user.id);
    if (access === "missing") return notFound("Space not found");
    if (access === "forbidden") return forbidden("Forbidden: You do not own this space");
    const source = await spaceSource(spaceId, sourceId);
    if (!source || source.provider !== "google" || source.authKind !== "oauth") return notFound("Review source not found");

    const config = googleOAuthConfig();
    if (!config) return badRequest("Signing in with Google is not set up on this installation.");
    const refreshToken = String(decryptCredentials(source.credentials).refreshToken ?? "");
    const accessToken = await refreshAccessToken(config, refreshToken);
    const locations = await listBusinessLocations(accessToken);
    return NextResponse.json({ locations });
  } catch (error) {
    if (error instanceof GoogleAuthError) return badRequest(error.message);
    if (error instanceof GoogleApiError) return badRequest(`Google said: ${error.message}`);
    log.error("Could not list Google business locations:", error);
    return internalError("Could not list your Google business locations");
  }
}
