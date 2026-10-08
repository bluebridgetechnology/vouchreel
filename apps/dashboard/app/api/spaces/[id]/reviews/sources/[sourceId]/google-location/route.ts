import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { badRequest, forbidden, internalError, notFound, unauthorized, validationError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reviewSources } from "@/lib/db/schema";
import { decryptCredentials } from "@/lib/reviews/crypto";
import { GoogleApiError, listBusinessLocations } from "@/lib/reviews/google-business";
import { GoogleAuthError, googleOAuthConfig, refreshAccessToken } from "@/lib/reviews/google-oauth";
import { spaceAccess, spaceSource } from "@/lib/reviews/owner";
import { syncReviewSource } from "@/lib/reviews/sync";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string; sourceId: string }>;
}

const bodySchema = z.object({ locationId: z.string().trim().min(1).max(200) });

/**
 * POST /api/spaces/[id]/reviews/sources/[sourceId]/google-location
 * Picks the business location for a source the owner just signed in for, switches it on and reads its reviews.
 * The location must be one the owner's Google account really manages: it is looked up again, not taken on trust.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  const { id: spaceId, sourceId } = await params;

  try {
    const access = await spaceAccess(spaceId, session.user.id);
    if (access === "missing") return notFound("Space not found");
    if (access === "forbidden") return forbidden("Forbidden: You do not own this space");
    const source = await spaceSource(spaceId, sourceId);
    if (!source || source.provider !== "google" || source.authKind !== "oauth") return notFound("Review source not found");

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError("Choose a location", parsed.error.flatten().fieldErrors);

    const config = googleOAuthConfig();
    if (!config) return badRequest("Signing in with Google is not set up on this installation.");
    const accessToken = await refreshAccessToken(config, String(decryptCredentials(source.credentials).refreshToken ?? ""));
    const location = (await listBusinessLocations(accessToken)).find((l) => l.id === parsed.data.locationId);
    if (!location) return badRequest("That location is not managed by the Google account you signed in with.");

    // The same location cannot feed two sources of one space
    const [taken] = await db
      .select({ id: reviewSources.id })
      .from(reviewSources)
      .where(and(eq(reviewSources.spaceId, spaceId), eq(reviewSources.provider, "google"), eq(reviewSources.providerBusinessId, location.id), ne(reviewSources.id, sourceId)));
    if (taken) return badRequest("This location is already connected.");

    await db
      .update(reviewSources)
      .set({ providerBusinessId: location.id, displayName: location.title, isActive: true, lastError: null })
      .where(eq(reviewSources.id, sourceId));

    let syncResult = null;
    let syncError: string | null = null;
    try {
      syncResult = await syncReviewSource(sourceId, { force: true });
    } catch (err) {
      syncError = err instanceof Error ? err.message : String(err);
    }
    return NextResponse.json({ source: { id: sourceId, providerBusinessId: location.id, displayName: location.title }, syncResult, syncError });
  } catch (error) {
    if (error instanceof GoogleAuthError) return badRequest(error.message);
    if (error instanceof GoogleApiError) return badRequest(`Google said: ${error.message}`);
    log.error("Could not choose the Google location:", error);
    return internalError("Could not save the location");
  }
}
