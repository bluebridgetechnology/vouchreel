import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { forbidden, internalError, notFound, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, reviewSources } from "@/lib/db/schema";
import { decryptCredentials } from "@/lib/reviews/crypto";
import { revokeToken } from "@/lib/reviews/google-oauth";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string; sourceId: string }>;
}

/**
 * DELETE /api/spaces/[id]/reviews/sources/[sourceId]
 * Disconnects and removes a review source (and cascaded reviews).
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId, sourceId } = await params;

  try {
    const [space] = await db
      .select({ id: spaces.id, ownerId: spaces.ownerId })
      .from(spaces)
      .where(eq(spaces.id, spaceId));

    if (!space) {
      return notFound("Space not found");
    }

    if (space.ownerId !== session.user.id) {
      return forbidden("Forbidden: You do not own this space");
    }

    const [source] = await db
      .select({ id: reviewSources.id, authKind: reviewSources.authKind, credentials: reviewSources.credentials })
      .from(reviewSources)
      .where(
        and(eq(reviewSources.id, sourceId), eq(reviewSources.spaceId, spaceId))
      );

    if (!source) {
      return notFound("Review source not found");
    }

    // Signed in with Google: tell Google to forget the access first (best effort; disconnecting never waits on Google)
    if (source.authKind === "oauth") {
      try {
        const refreshToken = String(decryptCredentials(source.credentials).refreshToken ?? "");
        if (refreshToken) await revokeToken(refreshToken);
      } catch (err) {
        log.warn("Could not revoke the Google access while disconnecting:", err);
      }
    }
    await db.delete(reviewSources).where(eq(reviewSources.id, sourceId));

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Failed to delete review source:", error);
    return internalError("Failed to delete review source");
  }
}
