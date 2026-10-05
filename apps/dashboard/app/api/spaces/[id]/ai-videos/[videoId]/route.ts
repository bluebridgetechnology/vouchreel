import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { aiVideoErrorResponse, requireSpaceOwner } from "@/lib/ai-video/access";
import { approveDraft, removeVideo } from "@/lib/ai-video/generate";
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

/** Deletes a video. A finished one is archived so its credit stays used; see removeVideo. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: spaceId, videoId } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  try {
    await removeVideo(videoId, spaceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return aiVideoErrorResponse(error, "Failed to delete the AI video");
  }
}
