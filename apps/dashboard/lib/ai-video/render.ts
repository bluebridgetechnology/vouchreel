import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import path from "path";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  generatedVideos,
  socialExportSettings,
  spaces,
  testimonialConsents,
  testimonials,
} from "@/lib/db/schema";
import { registerJobHandler, JOB_TYPES } from "@/lib/jobs/handlers";
import { ensureFfmpeg, friendlyMediaError, resolveFontFile, runFfmpeg } from "@/lib/media/ffmpeg";
import { notifySpaceOwner } from "@/lib/notifications/service";
import { getSubscriptionLimits } from "@/lib/payments/subscription";
import { getStorage } from "@/lib/storage";
import { buildCaptionChunks } from "./captions";
import { buildAiVideoArgs, wrapText, type TimedTextFile } from "./render-args";
import { ASPECT_DIMENSIONS, AI_VIDEO_LABEL, getTemplate } from "./templates";
import { getTtsProvider, TtsError } from "./tts";

/** User-safe reason for a failed render. Never leaks provider responses. */
export function friendlyAiVideoError(error: unknown): string {
  if (error instanceof TtsError) return error.userMessage;
  const generic = friendlyMediaError(error);
  return generic.startsWith("Video processing failed") ? "The video could not be rendered. Please try again." : generic;
}

/** Marks a video failed and tells the owner. Safe to call twice; a finished video is left alone. */
async function settleFailure(videoId: string, spaceId: string, message: string): Promise<void> {
  const failed = await db
    .update(generatedVideos)
    .set({ status: "failed", error: message, completedAt: new Date() })
    .where(and(eq(generatedVideos.id, videoId), inArray(generatedVideos.status, ["queued", "rendering"])))
    .returning({ id: generatedVideos.id });
  if (!failed.length) return;
  void notifySpaceOwner(spaceId, {
    type: "ai_video.failed",
    title: "An AI video could not be created",
    body: `${message} Your credit was not used.`,
    href: `/spaces/${spaceId}/testimonials`,
    metadata: { videoId },
  });
}

/**
 * Renders one approved AI video: narration, captions, upload. Throws on transient problems so
 * the job queue retries; settles permanent problems itself.
 */
export async function renderGeneratedVideo(videoId: string): Promise<void> {
  const [video] = await db.select().from(generatedVideos).where(eq(generatedVideos.id, videoId));
  if (!video || (video.status !== "queued" && video.status !== "rendering")) return;

  const [consent] = await db
    .select({ revokedAt: testimonialConsents.revokedAt })
    .from(testimonialConsents)
    .where(eq(testimonialConsents.id, video.consentId));
  if (!consent || consent.revokedAt) {
    return settleFailure(video.id, video.spaceId, "The customer withdrew their consent for AI video.");
  }

  const template = getTemplate(video.template);
  if (!template || !video.scriptTrimmed || !video.trimApprovedAt) {
    return settleFailure(video.id, video.spaceId, "This video was not set up correctly.");
  }

  await db.update(generatedVideos).set({ status: "rendering" }).where(eq(generatedVideos.id, video.id));

  const [testimonial] = await db.select().from(testimonials).where(eq(testimonials.id, video.testimonialId));
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, video.spaceId));
  if (!testimonial || !space) return settleFailure(video.id, video.spaceId, "The testimonial no longer exists.");

  const [settings] = await db.select().from(socialExportSettings).where(eq(socialExportSettings.spaceId, video.spaceId));
  const limits = await getSubscriptionLimits(space.ownerId);
  const showWatermark = limits.removeWatermark ? (settings?.showWatermark ?? true) : true;

  const tempDir = await mkdtemp(path.join(tmpdir(), "vouchreel-ai-video-"));
  try {
    let tts;
    try {
      tts = await getTtsProvider().synthesize({ text: video.scriptTrimmed, voiceId: video.voice });
    } catch (error) {
      if (error instanceof TtsError && !error.retryable) {
        return settleFailure(video.id, video.spaceId, error.userMessage);
      }
      throw error;
    }

    const audioPath = path.join(tempDir, `narration.${tts.mimeType === "audio/wav" ? "wav" : "mp3"}`);
    await writeFile(audioPath, tts.audio);

    const { maxLineChars } = ASPECT_DIMENSIONS[video.aspect];
    const writeText = async (name: string, text: string) => {
      const file = path.join(tempDir, name);
      await writeFile(file, text, "utf8");
      return file;
    };

    const captions: TimedTextFile[] = [];
    for (const [i, chunk] of buildCaptionChunks(tts.words, tts.durationSeconds).entries()) {
      captions.push({ textFile: await writeText(`caption-${i}.txt`, wrapText(chunk.text, maxLineChars)), start: chunk.start, end: chunk.end });
    }

    const byline = [testimonial.customerName, testimonial.customerCompany].filter(Boolean).join(", ");
    const outputPath = path.join(tempDir, "output.mp4");
    const args = buildAiVideoArgs({
      audioPath,
      outputPath,
      template,
      aspect: video.aspect,
      durationSeconds: tts.durationSeconds,
      captions,
      attributionFile: byline ? await writeText("attribution.txt", `- ${byline}`) : undefined,
      labelFile: await writeText("label.txt", AI_VIDEO_LABEL),
      watermarkFile: showWatermark ? await writeText("watermark.txt", "Made with Vouchreel") : undefined,
      fontFile: resolveFontFile(),
    });

    await ensureFfmpeg();
    await runFfmpeg(args);

    const outputUrl = await getStorage().upload(
      await readFile(outputPath),
      `ai-videos/${video.spaceId}/${video.testimonialId}/${video.id}-${randomUUID()}.mp4`,
      { contentType: "video/mp4", public: true, metadata: { videoId: video.id, aiGenerated: "true" } }
    );

    await db
      .update(generatedVideos)
      .set({
        status: "done",
        outputUrl,
        durationSeconds: Math.ceil(tts.durationSeconds),
        costCents: tts.costCents,
        error: null,
        completedAt: new Date(),
      })
      .where(eq(generatedVideos.id, video.id));

    void notifySpaceOwner(video.spaceId, {
      type: "ai_video.completed",
      title: "Your AI video is ready",
      body: testimonial.customerName ? `Made from ${testimonial.customerName}'s testimonial.` : undefined,
      href: `/spaces/${video.spaceId}/testimonials`,
      metadata: { videoId: video.id },
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function registerAiVideoHandler(): void {
  registerJobHandler(
    JOB_TYPES.aiVideo,
    async (payload) => {
      const videoId = payload.videoId;
      if (typeof videoId !== "string") throw new Error("ai_video job missing videoId");
      await renderGeneratedVideo(videoId);
    },
    {
      // Out of retries: free the credit (failed videos do not count) and tell the owner
      onFailed: async (payload, error) => {
        const videoId = payload.videoId;
        if (typeof videoId !== "string") return;
        const [video] = await db.select({ spaceId: generatedVideos.spaceId }).from(generatedVideos).where(eq(generatedVideos.id, videoId));
        if (video) await settleFailure(videoId, video.spaceId, friendlyAiVideoError(error));
      },
    }
  );
}
