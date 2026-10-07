import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviewSources, reviews } from "@/lib/db/schema";
import { decryptCredentials } from "./crypto";
import { fetchGoogleReviews, NormalizedReview } from "./google";
import { fetchTrustpilotReviews, fetchTrustpilotStats } from "./trustpilot";
import { log } from "@/lib/log";

export interface SyncResult {
  sourceId: string;
  provider: "google" | "trustpilot";
  importedCount: number;
  updatedCount: number;
  totalFetched: number;
  lastSyncAt: Date;
}

// Minimum interval between syncs in milliseconds to prevent API rate limit exhaustion (5 minutes)
export const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Synchronizes external reviews for a specific review source record.
 */
export async function syncReviewSource(
  sourceId: string,
  options?: { force?: boolean }
): Promise<SyncResult> {
  const [source] = await db
    .select()
    .from(reviewSources)
    .where(eq(reviewSources.id, sourceId));

  if (!source) {
    throw new Error(`Review source ${sourceId} not found.`);
  }

  if (!source.isActive) {
    throw new Error(`Review source ${sourceId} is inactive.`);
  }

  // Rate limiting check
  if (!options?.force && source.lastSyncAt) {
    const elapsed = Date.now() - new Date(source.lastSyncAt).getTime();
    if (elapsed < MIN_SYNC_INTERVAL_MS) {
      const waitMinutes = Math.ceil((MIN_SYNC_INTERVAL_MS - elapsed) / 60000);
      throw new Error(
        `Rate limit cooldown: Please wait ${waitMinutes} minute(s) before syncing again.`
      );
    }
  }

  const credentials = decryptCredentials(source.credentials);
  let fetchedReviews: NormalizedReview[] = [];
  /** Provider-reported overall rating and count; stays null when the provider does not give it. */
  let stats: { rating: number; total: number } | null = null;

  if (source.provider === "google") {
    const apiKey = credentials.apiKey as string | undefined;
    const placeId = source.providerBusinessId;
    const res = await fetchGoogleReviews({ placeId, apiKey });
    fetchedReviews = res.reviews;
    if (typeof res.rating === "number" && typeof res.totalReviews === "number" && res.totalReviews > 0) {
      stats = { rating: res.rating, total: res.totalReviews };
    }
  } else if (source.provider === "trustpilot") {
    const apiKey = credentials.apiKey as string | undefined;
    const businessUnitId = source.providerBusinessId;
    const res = await fetchTrustpilotReviews({ businessUnitId, apiKey, perPage: 50 });
    fetchedReviews = res.reviews;
    // Optional extra call; a failure here must never fail the review sync itself
    try {
      stats = (await fetchTrustpilotStats({ businessUnitId, apiKey })) ?? null;
    } catch {
      stats = null;
    }
  } else {
    throw new Error(`Unsupported provider: ${source.provider}`);
  }

  let importedCount = 0;
  let updatedCount = 0;

  for (const review of fetchedReviews) {
    // Check if review already exists
    const [existing] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.providerReviewId, review.providerReviewId));

    if (existing) {
      await db
        .update(reviews)
        .set({
          authorName: review.authorName,
          authorPhotoUrl: review.authorPhotoUrl,
          rating: review.rating,
          text: review.text,
          reviewDate: review.reviewDate,
        })
        .where(eq(reviews.id, existing.id));
      updatedCount++;
    } else {
      await db.insert(reviews).values({
        spaceId: source.spaceId,
        sourceId: source.id,
        provider: source.provider,
        providerReviewId: review.providerReviewId,
        authorName: review.authorName,
        authorPhotoUrl: review.authorPhotoUrl,
        rating: review.rating,
        text: review.text,
        reviewDate: review.reviewDate,
        isApproved: true,
      });
      importedCount++;
    }
  }

  const now = new Date();
  await db
    .update(reviewSources)
    .set({
      lastSyncAt: now,
      ...(stats ? { ratingAverage: stats.rating, ratingTotal: stats.total } : {}),
    })
    .where(eq(reviewSources.id, source.id));

  return {
    sourceId: source.id,
    provider: source.provider,
    importedCount,
    updatedCount,
    totalFetched: fetchedReviews.length,
    lastSyncAt: now,
  };
}

/**
 * Runs a background sync of all active review sources that have exceeded the sync cooldown.
 */
export async function syncAllActiveReviewSources(): Promise<{
  synced: SyncResult[];
  errors: Array<{ sourceId: string; error: string }>;
}> {
  const activeSources = await db
    .select()
    .from(reviewSources)
    .where(eq(reviewSources.isActive, true));

  const synced: SyncResult[] = [];
  const errors: Array<{ sourceId: string; error: string }> = [];

  for (const source of activeSources) {
    try {
      const result = await syncReviewSource(source.id, { force: false });
      synced.push(result);
    } catch (err) {
      // If error was just cooldown, ignore, otherwise log
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("Rate limit cooldown")) {
        log.error(`Failed to sync source ${source.id}:`, err);
        errors.push({ sourceId: source.id, error: message });
      }
    }
  }

  return { synced, errors };
}
