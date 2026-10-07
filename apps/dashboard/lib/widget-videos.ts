import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { generatedVideos, reviewVideos, testimonialConsents, testimonials } from "@/lib/db/schema";
import { AiVideoError } from "@/lib/ai-video/errors";

/**
 * Generated videos in the embedded widget. The owner switches each video on (off by default); what is
 * shown is decided here, in one place, from the live state of the video, so a takedown, a deleted video,
 * a withdrawn consent or a hidden testimonial removes it from the next response with no extra step.
 * Reviews and AI videos are both allowed (decision recorded in docs/gaps-register.md, C3).
 */

export type WidgetVideoKind = "review" | "ai";

/** A video in the shape the widget already plays (an MP4 testimonial), plus two fields only these have. */
export interface WidgetVideoItem {
  id: string;
  videoUrl: string;
  platform: "mp4";
  thumbnailUrl: null;
  title: null;
  quote: string | null;
  customerName: string;
  customerCompany: string | null;
  durationSeconds: number | null;
  /** Tells the widget to draw a first frame and drop the tile if the file is gone. */
  generated: WidgetVideoKind;
  /** Card label. AI videos also carry their label inside the video itself. */
  badge: string;
}

const REVIEW_BADGE = "⭐ Review video";
const AI_BADGE = "AI-generated video";

/** Turns a finished video on or off for the widget. Only a finished, live video can be shown. */
export async function setVideoInWidget(kind: WidgetVideoKind, videoId: string, spaceId: string, show: boolean): Promise<void> {
  const table = kind === "review" ? reviewVideos : generatedVideos;
  const [video] = await db
    .select({ status: table.status, outputUrl: table.outputUrl, deletedAt: table.deletedAt, moderatedAt: table.moderatedAt })
    .from(table)
    .where(and(eq(table.id, videoId), eq(table.spaceId, spaceId)));
  if (!video || video.deletedAt) throw new AiVideoError(404, "NOT_FOUND", "Video not found");
  if (show && (video.status !== "done" || !video.outputUrl || video.moderatedAt)) {
    throw new AiVideoError(400, "BAD_REQUEST", "Only a finished video can be shown in your widget.");
  }
  await db.update(table).set({ showInWidget: show }).where(eq(table.id, videoId));
}

function firstReview(props: unknown): { author: string; text: string } | null {
  const reviews = (props as { reviews?: { author?: unknown; text?: unknown }[] } | null)?.reviews;
  const first = Array.isArray(reviews) ? reviews[0] : null;
  return first && typeof first.author === "string" && typeof first.text === "string" ? { author: first.author, text: first.text } : null;
}

/** The videos the widget may show for a space, oldest chosen first. */
export async function listWidgetVideos(spaceId: string): Promise<WidgetVideoItem[]> {
  const [made, narrated] = await Promise.all([
    db
      .select({ id: reviewVideos.id, url: reviewVideos.outputUrl, props: reviewVideos.props, seconds: reviewVideos.durationSeconds })
      .from(reviewVideos)
      .where(
        and(
          eq(reviewVideos.spaceId, spaceId),
          eq(reviewVideos.showInWidget, true),
          eq(reviewVideos.status, "done"),
          isNotNull(reviewVideos.outputUrl),
          isNull(reviewVideos.deletedAt),
          isNull(reviewVideos.moderatedAt)
        )
      )
      .orderBy(asc(reviewVideos.createdAt)),
    // An AI video needs the consent it was made under to still stand, and its testimonial to still be shown
    db
      .select({
        id: generatedVideos.id,
        url: generatedVideos.outputUrl,
        seconds: generatedVideos.durationSeconds,
        quote: testimonials.quote,
        name: testimonials.customerName,
        company: testimonials.customerCompany,
      })
      .from(generatedVideos)
      .innerJoin(testimonialConsents, eq(testimonialConsents.id, generatedVideos.consentId))
      .innerJoin(testimonials, eq(testimonials.id, generatedVideos.testimonialId))
      .where(
        and(
          eq(generatedVideos.spaceId, spaceId),
          eq(generatedVideos.showInWidget, true),
          eq(generatedVideos.status, "done"),
          isNotNull(generatedVideos.outputUrl),
          isNull(generatedVideos.deletedAt),
          isNull(generatedVideos.moderatedAt),
          isNull(testimonialConsents.revokedAt),
          eq(testimonials.isActive, true)
        )
      )
      .orderBy(asc(generatedVideos.createdAt)),
  ]);

  const items: WidgetVideoItem[] = [];
  for (const v of made) {
    const review = firstReview(v.props);
    const single = ((v.props as { reviews?: unknown[] }).reviews?.length ?? 0) === 1;
    items.push({
      id: v.id,
      videoUrl: v.url!,
      platform: "mp4",
      thumbnailUrl: null,
      title: null,
      quote: single && review ? review.text : null,
      customerName: single && review ? review.author : "Customer reviews",
      customerCompany: null,
      durationSeconds: v.seconds,
      generated: "review",
      badge: REVIEW_BADGE,
    });
  }
  for (const v of narrated) {
    items.push({
      id: v.id,
      videoUrl: v.url!,
      platform: "mp4",
      thumbnailUrl: null,
      title: null,
      quote: v.quote,
      customerName: v.name || "Customer",
      customerCompany: v.company,
      durationSeconds: v.seconds,
      generated: "ai",
      badge: AI_BADGE,
    });
  }
  return items;
}

