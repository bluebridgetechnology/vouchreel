import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviewVideos } from "@/lib/db/schema";
import { JOB_TYPES, registerJobHandler } from "@/lib/jobs/handlers";
import { friendlyReviewVideoError, renderQueuedReviewVideo, settleReviewVideoFailure } from "./render";

/** Registers the review-video handler. Only the video worker calls this (it has Chromium). */
export function registerVideoHandlers(): void {
  registerJobHandler(
    JOB_TYPES.reviewVideo,
    async (payload) => {
      const videoId = payload.videoId;
      if (typeof videoId !== "string") throw new Error("review_video job missing videoId");
      await renderQueuedReviewVideo(videoId);
    },
    {
      // Out of retries: free the credit (failed videos do not count) and tell the owner
      onFailed: async (payload, error) => {
        const videoId = payload.videoId;
        if (typeof videoId !== "string") return;
        const [video] = await db.select({ spaceId: reviewVideos.spaceId }).from(reviewVideos).where(eq(reviewVideos.id, videoId));
        if (video) await settleReviewVideoFailure(videoId, video.spaceId, friendlyReviewVideoError(error));
      },
    }
  );
}
