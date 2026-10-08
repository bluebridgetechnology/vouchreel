import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import {
  badRequest,
  forbidden,
  internalError,
  notFound,
  unauthorized,
  validationError,
} from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, reviewSources } from "@/lib/db/schema";
import { connectReviewSourceSchema } from "@/lib/validations/reviews";
import { encryptCredentials } from "@/lib/reviews/crypto";
import { syncReviewSource } from "@/lib/reviews/sync";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/spaces/[id]/reviews/sources
 * Connects or updates an external review source (Google Place or Trustpilot Business).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId } = await params;

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

    const body = await request.json();
    const validated = connectReviewSourceSchema.safeParse(body);

    if (!validated.success) {
      return validationError(
        "Validation failed",
        validated.error.flatten().fieldErrors
      );
    }

    const { provider, providerBusinessId, apiKey, metadata, syncNow } =
      validated.data;

    // Encrypt credentials
    const credentialsObj: Record<string, unknown> = {
      ...metadata,
    };
    if (apiKey) {
      credentialsObj.apiKey = apiKey;
    }

    const encryptedCreds = encryptCredentials(credentialsObj);

    // Check if source already exists for this space and provider
    const [existing] = await db
      .select()
      .from(reviewSources)
      .where(
        and(
          eq(reviewSources.spaceId, spaceId),
          eq(reviewSources.provider, provider),
          eq(reviewSources.providerBusinessId, providerBusinessId)
        )
      );

    // One Google source per space: a different one (for example a Google sign-in) has to be disconnected first
    if (provider === "google") {
      const others = await db
        .select({ id: reviewSources.id, providerBusinessId: reviewSources.providerBusinessId })
        .from(reviewSources)
        .where(and(eq(reviewSources.spaceId, spaceId), eq(reviewSources.provider, "google")));
      if (others.some((o) => o.providerBusinessId !== providerBusinessId)) {
        return badRequest("This space already has a Google source. Disconnect it before connecting another.");
      }
    }

    let sourceId: string;
    let savedSource;

    if (existing) {
      const [updated] = await db
        .update(reviewSources)
        .set({
          credentials: encryptedCreds,
          authKind: "api_key",
          lastError: null,
          isActive: true,
        })
        .where(eq(reviewSources.id, existing.id))
        .returning();

      sourceId = existing.id;
      savedSource = updated;
    } else {
      const [inserted] = await db
        .insert(reviewSources)
        .values({
          spaceId,
          provider,
          providerBusinessId,
          credentials: encryptedCreds,
          authKind: "api_key",
          isActive: true,
        })
        .returning();

      sourceId = inserted.id;
      savedSource = inserted;
    }

    let syncResult = null;
    let syncError = null;

    if (syncNow) {
      try {
        syncResult = await syncReviewSource(sourceId, { force: true });
      } catch (err) {
        syncError = err instanceof Error ? err.message : String(err);
      }
    }

    return NextResponse.json(
      {
        source: {
          id: savedSource.id,
          provider: savedSource.provider,
          providerBusinessId: savedSource.providerBusinessId,
          lastSyncAt: savedSource.lastSyncAt,
          isActive: savedSource.isActive,
        },
        syncResult,
        syncError,
      },
      { status: 201 }
    );
  } catch (error) {
    log.error("Failed to connect review source:", error);
    return internalError("Failed to connect review source");
  }
}
