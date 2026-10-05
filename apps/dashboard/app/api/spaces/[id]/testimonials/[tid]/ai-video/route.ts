import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { aiVideoErrorResponse, requireSpaceOwner } from "@/lib/ai-video/access";
import { getAiVideoCredits } from "@/lib/ai-video/credits";
import { AI_VIDEO_OPTIONS, createDraft, findActiveConsent } from "@/lib/ai-video/generate";
import { isTtsConfigured } from "@/lib/ai-video/tts";
import { diffRemovedWords } from "@/lib/ai-video/trim";
import { db } from "@/lib/db";
import { generatedVideos } from "@/lib/db/schema";
import { createAiVideoSchema } from "@/lib/validations/ai-video";

interface RouteParams {
  params: Promise<{ id: string; tid: string }>;
}

/** Everything the "Generate video" panel needs: past videos, credits, consent, and the choices. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: spaceId, tid } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  try {
    const [videos, consent, credits] = await Promise.all([
      db
        .select()
        .from(generatedVideos)
        .where(and(eq(generatedVideos.testimonialId, tid), eq(generatedVideos.spaceId, spaceId), isNull(generatedVideos.deletedAt)))
        .orderBy(desc(generatedVideos.createdAt)),
      findActiveConsent(tid),
      getAiVideoCredits(access.ownerId),
    ]);
    return NextResponse.json({
      videos: videos.map((v) => ({
        ...v,
        diff: v.scriptTrimmed ? diffRemovedWords(v.scriptOriginal, v.scriptTrimmed) : null,
      })),
      consent: Boolean(consent),
      /** False when no narration provider is configured, so the UI can say so instead of failing on click. */
      narrationAvailable: isTtsConfigured(),
      credits: { ...credits, limit: Number.isFinite(credits.limit) ? credits.limit : null },
      options: AI_VIDEO_OPTIONS,
    });
  } catch (error) {
    return aiVideoErrorResponse(error, "Failed to load AI videos");
  }
}

/** Creates a draft with a proposed trim. No credit is spent and nothing renders until approval. */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: spaceId, tid } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  const parsed = createAiVideoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Validation failed", { details: parsed.error.flatten().fieldErrors });
  }

  try {
    const { video, credits } = await createDraft({ spaceId, testimonialId: tid, userId: access.userId, ...parsed.data });
    return NextResponse.json(
      {
        video: { ...video, diff: video.scriptTrimmed ? diffRemovedWords(video.scriptOriginal, video.scriptTrimmed) : null },
        credits: { ...credits, limit: Number.isFinite(credits.limit) ? credits.limit : null },
      },
      { status: 201 }
    );
  } catch (error) {
    return aiVideoErrorResponse(error, "Failed to start the AI video");
  }
}
