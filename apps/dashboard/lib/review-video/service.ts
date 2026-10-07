import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { adjustmentFor, applyAdjustment } from "@/lib/admin/credit-adjustments";
import { REVIEW_RIGHTS_VERSION } from "./rights";
import { db } from "@/lib/db";
import { reviewSources, reviewVideos, reviews, socialExportSettings, spaces } from "@/lib/db/schema";
import { deleteVideoFile } from "@/lib/storage/video-files";
import { AiVideoError } from "@/lib/ai-video/errors";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";
import { getBrandKit } from "@/lib/brand-kit/service";
import { enqueueJob } from "@/lib/jobs/queue";
import { JOB_TYPES } from "@/lib/jobs/handlers";
import { getSubscriptionLimits } from "@/lib/payments/subscription";
import {
  TEMPLATES,
  getTemplate,
  reviewFits,
  validateProps,
  type Aspect,
  type BackgroundStyle,
  type ReviewVideoProps,
  type VideoAggregate,
  type VideoReview,
  type VideoTheme,
} from "@vouchreel/video";
import { log } from "@/lib/log";

/**
 * Review videos: styled videos made from reviews imported from Google or Trustpilot.
 * Rules this module enforces:
 *  - review text is used verbatim (templates never shorten or reword it);
 *  - the owner must confirm they may use the reviews in marketing;
 *  - the exact rendered content is stored with the video.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

export const MAX_REVIEW_LIST = 200;

/** "March 2026" from the review date; undefined when the provider gave none. */
export function formatReviewMonth(date: Date | null | undefined): string | undefined {
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface ReviewVideoCredits {
  limit: number;
  used: number;
  remaining: number;
}

type Executor = Pick<typeof db, "select">;

/** Credits are per account, counted when the video is created. A failed render is the refund. */
export async function getReviewVideoCredits(ownerId: string, executor: Executor = db, now = new Date()): Promise<ReviewVideoCredits> {
  const limits = await getSubscriptionLimits(ownerId);
  const [row] = await executor
    .select({ used: sql<number>`coalesce(sum(${reviewVideos.creditsUsed}), 0)::int` })
    .from(reviewVideos)
    .innerJoin(spaces, eq(spaces.id, reviewVideos.spaceId))
    .where(
      and(
        eq(spaces.ownerId, ownerId),
        inArray(reviewVideos.status, ["queued", "rendering", "done"]),
        gte(reviewVideos.createdAt, startOfMonthUtc(now))
      )
    );
  const used = row?.used ?? 0;
  const limit = applyAdjustment(limits.reviewVideoCredits, await adjustmentFor(ownerId, "review", now));
  return { limit, used, remaining: Math.max(0, limit - used) };
}

export interface ReviewOption {
  id: string;
  author: string;
  rating: number;
  text: string;
  source: "google" | "trustpilot";
  date: string | null;
  /** Template ids this review can be shown in without shortening it. */
  fits: string[];
}

export interface SourceStats {
  source: "google" | "trustpilot";
  rating: number;
  total: number;
}

/** Approved reviews with text, newest first, plus which templates each one fits. */
export async function listReviewOptions(spaceId: string): Promise<{ reviews: ReviewOption[]; stats: SourceStats[] }> {
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.spaceId, spaceId), eq(reviews.isApproved, true)))
    .orderBy(desc(reviews.reviewDate))
    .limit(MAX_REVIEW_LIST);

  const options: ReviewOption[] = rows
    .filter((r) => (r.text ?? "").trim().length > 0)
    .map((r) => ({
      id: r.id,
      author: r.authorName,
      rating: r.rating,
      text: r.text!.trim(),
      source: r.provider,
      date: formatReviewMonth(r.reviewDate) ?? null,
      fits: TEMPLATES.filter((t) => reviewFits(t, { text: r.text! })).map((t) => t.id),
    }));

  const sources = await db.select().from(reviewSources).where(eq(reviewSources.spaceId, spaceId));
  const stats: SourceStats[] = sources
    .filter((s) => s.ratingAverage != null && s.ratingTotal != null && s.ratingTotal > 0)
    .map((s) => ({ source: s.provider, rating: s.ratingAverage!, total: s.ratingTotal! }));

  return { reviews: options, stats };
}

export interface CreateReviewVideoInput {
  spaceId: string;
  userId: string;
  template: string;
  aspect: Aspect;
  /** In display order. */
  reviewIds: string[];
  brandColor?: string;
  /** Background style for this video. Omit to use the brand kit's default (then the template's own). */
  style?: BackgroundStyle;
  /** Second colour for this video. Omit to use the brand kit's; null for none. */
  secondaryColor?: string | null;
  /** The owner confirmed they may use these reviews in marketing. */
  rightsConfirmed: boolean;
}

/** Builds the exact content to render from stored reviews. Pure given its inputs; exported for tests. */
export function buildProps(
  rows: { authorName: string; rating: number; text: string | null; reviewDate: Date | null; provider: "google" | "trustpilot" }[],
  brand: string,
  aggregate?: VideoAggregate,
  theme?: VideoTheme
): ReviewVideoProps {
  const items: VideoReview[] = rows.map((r) => ({
    author: r.authorName.trim(),
    rating: r.rating,
    text: (r.text ?? "").trim(), // verbatim: only surrounding whitespace is removed
    date: formatReviewMonth(r.reviewDate),
    source: r.provider,
  }));
  return { reviews: items, brand, ...(aggregate ? { aggregate } : {}), ...(theme && (theme.style || theme.secondary) ? { theme } : {}) };
}

export async function createReviewVideo(input: CreateReviewVideoInput) {
  if (!input.rightsConfirmed) {
    throw new AiVideoError(400, "BAD_REQUEST", "Please confirm you have the right to use these reviews in your marketing.");
  }
  const template = getTemplate(input.template);
  if (!template) throw new AiVideoError(400, "VALIDATION_ERROR", "Unknown template.");

  const ids = [...new Set(input.reviewIds)];
  if (ids.length !== input.reviewIds.length) throw new AiVideoError(400, "VALIDATION_ERROR", "Each review can only be picked once.");

  const rows = await db
    .select()
    .from(reviews)
    .where(and(inArray(reviews.id, ids), eq(reviews.spaceId, input.spaceId), eq(reviews.isApproved, true)));
  if (rows.length !== ids.length) throw new AiVideoError(404, "NOT_FOUND", "One or more reviews were not found.");
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)!);

  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, input.spaceId));
  if (!space) throw new AiVideoError(404, "NOT_FOUND", "Space not found");

  const kit = await getBrandKit(input.spaceId);
  // Brand colour: this video's choice, then the brand kit, then the social export colour, then the product default
  let brand = input.brandColor ?? kit?.primaryColor;
  if (!brand) {
    const [settings] = await db.select({ brandColor: socialExportSettings.brandColor }).from(socialExportSettings).where(eq(socialExportSettings.spaceId, input.spaceId));
    brand = settings?.brandColor ?? DEFAULT_BRAND_HEX;
  }
  if (!HEX.test(brand)) throw new AiVideoError(400, "VALIDATION_ERROR", "Brand colour must be a hex colour like #cf3d0b.");

  // Rating totals come from the provider (stored at sync), for the source of the featured review
  let aggregate: VideoAggregate | undefined;
  if (template.requiresAggregate) {
    const provider = ordered[0].provider;
    const [source] = await db
      .select()
      .from(reviewSources)
      .where(and(eq(reviewSources.spaceId, input.spaceId), eq(reviewSources.provider, provider)));
    if (source?.ratingAverage != null && source.ratingTotal != null && source.ratingTotal > 0) {
      aggregate = { source: provider, rating: Math.round(source.ratingAverage * 10) / 10, total: source.ratingTotal };
    }
  }

  // Background: this video's choice, then the brand kit's default; otherwise each template uses its own default
  const style = input.style ?? kit?.videoStyle ?? undefined;
  const secondary = input.secondaryColor === undefined ? (kit?.videoSecondaryColor ?? undefined) : (input.secondaryColor ?? undefined);
  const props = buildProps(ordered, brand, aggregate, { ...(style ? { style } : {}), ...(secondary ? { secondary } : {}) });
  const problems = validateProps(template.id, props);
  if (problems.length) throw new AiVideoError(422, "VALIDATION_ERROR", problems.join(" "), { problems });

  return db.transaction(async (tx) => {
    // Serialise per account so two requests cannot both spend the last credit
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${space.ownerId}, 1))`);
    const credits = await getReviewVideoCredits(space.ownerId, tx);
    if (credits.remaining < 1) {
      throw new AiVideoError(
        403,
        "PLAN_LIMIT",
        credits.limit === 0
          ? "Review videos are not included in your plan."
          : `You have used all ${credits.limit} review videos this month. They reset on the 1st.`,
        { used: credits.used, limit: Number.isFinite(credits.limit) ? credits.limit : null }
      );
    }

    const [video] = await tx
      .insert(reviewVideos)
      .values({
        spaceId: input.spaceId,
        createdBy: input.userId,
        template: template.id,
        aspect: input.aspect,
        status: "queued",
        props: props as unknown as Record<string, unknown>,
        reviewIds: ids,
        rightsConfirmedAt: new Date(),
        rightsWordingVersion: REVIEW_RIGHTS_VERSION,
      })
      .returning();
    const job = await enqueueJob(JOB_TYPES.reviewVideo, { videoId: video.id }, {}, tx);
    const [updated] = await tx.update(reviewVideos).set({ jobId: job.id }).where(eq(reviewVideos.id, video.id)).returning();
    return updated;
  });
}

export async function listReviewVideos(spaceId: string) {
  return db
    .select()
    .from(reviewVideos)
    .where(and(eq(reviewVideos.spaceId, spaceId), isNull(reviewVideos.deletedAt)))
    .orderBy(desc(reviewVideos.createdAt))
    .limit(100);
}

/** Finished videos are archived (their credit stays used) and their stored file is deleted; queued or failed ones are handled accordingly. */
export async function removeReviewVideo(videoId: string, spaceId: string): Promise<"removed" | "archived"> {
  const [video] = await db
    .select({ status: reviewVideos.status, deletedAt: reviewVideos.deletedAt, outputUrl: reviewVideos.outputUrl })
    .from(reviewVideos)
    .where(and(eq(reviewVideos.id, videoId), eq(reviewVideos.spaceId, spaceId)));
  if (!video || video.deletedAt) throw new AiVideoError(404, "NOT_FOUND", "Video not found");
  if (video.status === "queued" || video.status === "rendering") {
    throw new AiVideoError(400, "BAD_REQUEST", "This video is being created. Wait for it to finish.");
  }
  if (video.status === "done") {
    // The file is public, so deleting the video must delete it too. If storage fails nothing changes and the owner can retry.
    try {
      await deleteVideoFile(video.outputUrl, "review");
    } catch (error) {
      log.error(`[review-video] could not delete the file of video ${videoId}:`, error);
      throw new AiVideoError(502, "INTERNAL_ERROR", "We could not delete the video file just now. Nothing was changed; please try again.");
    }
    await db.update(reviewVideos).set({ deletedAt: new Date(), outputUrl: null }).where(eq(reviewVideos.id, videoId));
    return "archived";
  }
  await db.delete(reviewVideos).where(eq(reviewVideos.id, videoId));
  return "removed";
}
