import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  generatedVideos,
  spaces,
  testimonialConsents,
  testimonials,
  testimonialTranslations,
} from "@/lib/db/schema";
import { enqueueJob } from "@/lib/jobs/queue";
import { JOB_TYPES } from "@/lib/jobs/handlers";
import { getAiVideoCredits } from "./credits";
import { AiVideoError } from "./errors";
import { AI_VIDEO_TEMPLATES, getTemplate, type AiVideoAspect } from "./templates";
import { VOICES, getVoice, isTtsConfigured } from "./tts";
import { proposeTrim, validateTrim } from "./trim";
import { deleteVideoFile } from "@/lib/storage/video-files";

export interface CreateDraftInput {
  spaceId: string;
  testimonialId: string;
  userId: string;
  template: string;
  voice: string;
  aspect: AiVideoAspect;
  /** "original" or a language code that already has a stored, non-mock translation. */
  language?: string;
}

/** The consent evidence a video may be made under: latest AI-video consent that is not revoked. */
export async function findActiveConsent(testimonialId: string) {
  const [consent] = await db
    .select()
    .from(testimonialConsents)
    .where(
      and(
        eq(testimonialConsents.testimonialId, testimonialId),
        eq(testimonialConsents.kind, "ai_video"),
        isNull(testimonialConsents.revokedAt)
      )
    )
    .orderBy(desc(testimonialConsents.grantedAt))
    .limit(1);
  return consent ?? null;
}

/**
 * Starts a generation: checks everything that can be checked up front and stores a draft with a
 * proposed length trim. Nothing is rendered and no credit is spent until the owner approves.
 */
export async function createDraft(input: CreateDraftInput) {
  if (!isTtsConfigured()) {
    throw new AiVideoError(503, "INTERNAL_ERROR", "AI video narration is not available right now.");
  }
  if (!getTemplate(input.template)) throw new AiVideoError(400, "VALIDATION_ERROR", "Unknown template.");
  if (!getVoice(input.voice)) throw new AiVideoError(400, "VALIDATION_ERROR", "Unknown voice.");

  const [testimonial] = await db
    .select()
    .from(testimonials)
    .where(and(eq(testimonials.id, input.testimonialId), eq(testimonials.spaceId, input.spaceId)));
  if (!testimonial) throw new AiVideoError(404, "NOT_FOUND", "Testimonial not found");
  if (testimonial.platform !== "text" || !testimonial.quote?.trim()) {
    throw new AiVideoError(400, "BAD_REQUEST", "AI video can only be made from a written testimonial.");
  }

  const consent = await findActiveConsent(testimonial.id);
  if (!consent) {
    throw new AiVideoError(
      403,
      "FORBIDDEN",
      "The customer has not agreed to AI video for this testimonial. Videos can only be made from testimonials with consent."
    );
  }

  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, input.spaceId));
  if (!space) throw new AiVideoError(404, "NOT_FOUND", "Space not found");
  const credits = await getAiVideoCredits(space.ownerId);
  if (credits.limit === 0) {
    throw new AiVideoError(403, "PLAN_LIMIT", "AI video is not included in your plan. Upgrade to create videos.");
  }

  let script = testimonial.quote.trim();
  const language = input.language && input.language !== "original" ? input.language.toLowerCase() : "original";
  if (language !== "original") {
    const [translation] = await db
      .select()
      .from(testimonialTranslations)
      .where(and(eq(testimonialTranslations.testimonialId, testimonial.id), eq(testimonialTranslations.language, language)));
    // The mock provider prefixes text with a language tag; narrating that would be fabricating content
    if (!translation?.quote || translation.provider === "mock") {
      throw new AiVideoError(400, "BAD_REQUEST", "There is no real translation for that language yet. Translate the testimonial first.");
    }
    script = translation.quote.trim();
  }

  const [video] = await db
    .insert(generatedVideos)
    .values({
      spaceId: input.spaceId,
      testimonialId: testimonial.id,
      consentId: consent.id,
      createdBy: input.userId,
      status: "draft",
      template: input.template,
      voice: input.voice,
      aspect: input.aspect,
      language,
      scriptOriginal: script,
      scriptTrimmed: proposeTrim(script),
    })
    .returning();

  return { video, credits };
}

export interface ApproveInput {
  videoId: string;
  spaceId: string;
  /** Owner-edited script. Must only delete words from the original. Omit to accept the proposal. */
  script?: string;
}

/**
 * Owner approves the script: the credit is taken and the render job queued, atomically. The
 * advisory lock serialises approvals per account so two at once cannot both spend the last credit.
 */
export async function approveDraft(input: ApproveInput) {
  return db.transaction(async (tx) => {
    const [video] = await tx
      .select()
      .from(generatedVideos)
      .where(and(eq(generatedVideos.id, input.videoId), eq(generatedVideos.spaceId, input.spaceId)))
      .for("update");
    if (!video) throw new AiVideoError(404, "NOT_FOUND", "Video not found");
    if (video.status !== "draft") throw new AiVideoError(400, "BAD_REQUEST", "This video was already approved.");

    const script = (input.script ?? video.scriptTrimmed ?? video.scriptOriginal).trim();
    const check = validateTrim(video.scriptOriginal, script);
    if (!check.ok) throw new AiVideoError(422, "VALIDATION_ERROR", check.reason);

    const [consent] = await tx
      .select({ revokedAt: testimonialConsents.revokedAt })
      .from(testimonialConsents)
      .where(eq(testimonialConsents.id, video.consentId));
    if (!consent || consent.revokedAt) {
      throw new AiVideoError(403, "FORBIDDEN", "The customer withdrew their consent for AI video.");
    }

    const [space] = await tx.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, video.spaceId));
    if (!space) throw new AiVideoError(404, "NOT_FOUND", "Space not found");

    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${space.ownerId}, 0))`);
    const credits = await getAiVideoCredits(space.ownerId, tx);
    if (credits.remaining < video.creditsUsed) {
      throw new AiVideoError(
        403,
        "PLAN_LIMIT",
        credits.limit === 0
          ? "AI video is not included in your plan."
          : `You have used all ${credits.limit} AI video credits this month. They reset on the 1st.`,
        { used: credits.used, limit: Number.isFinite(credits.limit) ? credits.limit : null }
      );
    }

    const job = await enqueueJob(JOB_TYPES.aiVideo, { videoId: video.id }, {}, tx);
    const [updated] = await tx
      .update(generatedVideos)
      .set({ status: "queued", scriptTrimmed: script, trimApprovedAt: new Date(), jobId: job.id })
      .where(eq(generatedVideos.id, video.id))
      .returning();
    return updated;
  });
}

/**
 * Owner deletes a video. A finished video is archived rather than removed, otherwise deleting
 * it would hand the credit back, but its stored file is deleted so the public link stops working. Drafts and failed videos used no credit and are removed.
 */
export async function removeVideo(videoId: string, spaceId: string): Promise<"removed" | "archived"> {
  const [video] = await db
    .select({ status: generatedVideos.status, deletedAt: generatedVideos.deletedAt, outputUrl: generatedVideos.outputUrl })
    .from(generatedVideos)
    .where(and(eq(generatedVideos.id, videoId), eq(generatedVideos.spaceId, spaceId)));
  if (!video || video.deletedAt) throw new AiVideoError(404, "NOT_FOUND", "Video not found");
  if (video.status === "queued" || video.status === "rendering") {
    throw new AiVideoError(400, "BAD_REQUEST", "This video is being created. Wait for it to finish.");
  }
  if (video.status === "done") {
    // The file is public, so deleting the video must delete it too. If storage fails nothing changes and the owner can retry.
    try {
      await deleteVideoFile(video.outputUrl, "ai");
    } catch (error) {
      console.error(`[ai-video] could not delete the file of video ${videoId}:`, error);
      throw new AiVideoError(502, "INTERNAL_ERROR", "We could not delete the video file just now. Nothing was changed; please try again.");
    }
    await db.update(generatedVideos).set({ deletedAt: new Date(), outputUrl: null }).where(eq(generatedVideos.id, videoId));
    return "archived";
  }
  await db.delete(generatedVideos).where(eq(generatedVideos.id, videoId));
  return "removed";
}

export const AI_VIDEO_OPTIONS = {
  templates: AI_VIDEO_TEMPLATES.map(({ id, label, background, text }) => ({ id, label, background, text })),
  voices: VOICES.map(({ id, label }) => ({ id, label })),
  aspects: ["9:16", "16:9"] as AiVideoAspect[],
};
