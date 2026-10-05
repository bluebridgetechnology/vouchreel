import { mkdtemp, readFile, rm } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import path from "path";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviewVideos } from "@/lib/db/schema";
import { notifySpaceOwner } from "@/lib/notifications/service";
import { getStorage } from "@/lib/storage";
import { InvalidVideoPropsError, renderReviewVideo } from "@vouchreel/video/render";
import type { Aspect, ReviewVideoProps } from "@vouchreel/video";

/**
 * Server-only render step, run by the video worker (lib/jobs/main-video.ts). It imports the
 * Remotion renderer, so it must never be imported from the web app's routes.
 */

/** User-safe reason for a failed render. Never leaks renderer internals. */
export function friendlyReviewVideoError(error: unknown): string {
  if (error instanceof InvalidVideoPropsError) return error.message;
  const message = error instanceof Error ? error.message : "";
  if (/timed out|timeout/i.test(message)) return "The video took too long to render and was stopped. Please try again.";
  return "The video could not be rendered. Please try again.";
}

/** Marks a video failed and tells the owner. Safe to call twice; a finished video is left alone. */
export async function settleReviewVideoFailure(videoId: string, spaceId: string, message: string): Promise<void> {
  const failed = await db
    .update(reviewVideos)
    .set({ status: "failed", error: message, completedAt: new Date() })
    .where(and(eq(reviewVideos.id, videoId), inArray(reviewVideos.status, ["queued", "rendering"])))
    .returning({ id: reviewVideos.id });
  if (!failed.length) return;
  void notifySpaceOwner(spaceId, {
    type: "review_video.failed",
    title: "A review video could not be created",
    body: `${message} Your credit was not used.`,
    href: `/spaces/${spaceId}/reviews`,
    metadata: { videoId },
  });
}

/** Renders one queued review video, uploads it, and records the result. Throws on transient problems so the queue retries. */
export async function renderQueuedReviewVideo(videoId: string): Promise<void> {
  const [video] = await db.select().from(reviewVideos).where(eq(reviewVideos.id, videoId));
  if (!video || (video.status !== "queued" && video.status !== "rendering")) return;

  await db.update(reviewVideos).set({ status: "rendering" }).where(eq(reviewVideos.id, video.id));

  const tempDir = await mkdtemp(path.join(tmpdir(), "vouchreel-review-video-"));
  try {
    const started = Date.now();
    let result;
    try {
      result = await renderReviewVideo({
        templateId: video.template,
        aspect: video.aspect as Aspect,
        props: video.props as unknown as ReviewVideoProps,
        outputPath: path.join(tempDir, "output.mp4"),
      });
    } catch (error) {
      // Content that can never render is a permanent failure, not something to retry
      if (error instanceof InvalidVideoPropsError) {
        return settleReviewVideoFailure(video.id, video.spaceId, friendlyReviewVideoError(error));
      }
      throw error;
    }
    const renderMs = Date.now() - started;

    const outputUrl = await getStorage().upload(
      await readFile(path.join(tempDir, "output.mp4")),
      `review-videos/${video.spaceId}/${video.id}-${randomUUID()}.mp4`,
      { contentType: "video/mp4", public: true, metadata: { videoId: video.id, template: video.template } }
    );

    await db
      .update(reviewVideos)
      .set({
        status: "done",
        outputUrl,
        durationSeconds: Math.ceil(result.durationSeconds),
        renderMs,
        error: null,
        completedAt: new Date(),
      })
      .where(eq(reviewVideos.id, video.id));

    void notifySpaceOwner(video.spaceId, {
      type: "review_video.completed",
      title: "Your review video is ready",
      href: `/spaces/${video.spaceId}/reviews`,
      metadata: { videoId: video.id },
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
