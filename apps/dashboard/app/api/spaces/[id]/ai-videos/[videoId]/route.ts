import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { aiVideoErrorResponse, requireSpaceOwner } from "@/lib/ai-video/access";
import { approveDraft } from "@/lib/ai-video/generate";
import { db } from "@/lib/db";
import { generatedVideos } from "@/lib/db/schema";
import { reviewAiVideoSchema } from "@/lib/validations/ai-video";

interface RouteParams {
  params: Promise<{ id: string; videoId: string }>;
}

/** Approve the (optionally edited) script: takes one credit and queues the render. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: spaceId, videoId } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  const parsed = reviewAiVideoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Validation failed", { details: parsed.error.flatten().fieldErrors });
  }

  try {
    const video = await approveDraft({ videoId, spaceId, script: parsed.data.script });
    return NextResponse.json({ video });
  } catch (error) {
    return aiVideoErrorResponse(error, "Failed to approve the AI video");
  }
}

/** Removes a video that is not currently rendering. Credits already spent are not refunded. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: spaceId, videoId } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  const [video] = await db
    .select({ status: generatedVideos.status })
    .from(generatedVideos)
    .where(and(eq(generatedVideos.id, videoId), eq(generatedVideos.spaceId, spaceId)));
  if (!video) return apiError(404, "NOT_FOUND", "Video not found");
  if (video.status === "queued" || video.status === "rendering") {
    return apiError(400, "BAD_REQUEST", "This video is being created. Wait for it to finish.");
  }

  await db.delete(generatedVideos).where(eq(generatedVideos.id, videoId));
  return NextResponse.json({ success: true });
}
