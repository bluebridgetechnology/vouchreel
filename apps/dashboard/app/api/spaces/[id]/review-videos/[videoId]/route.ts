import { NextResponse } from "next/server";
import { aiVideoErrorResponse, requireSpaceOwner } from "@/lib/ai-video/access";
import { removeReviewVideo } from "@/lib/review-video/service";

interface RouteParams {
  params: Promise<{ id: string; videoId: string }>;
}

/** Deletes a video. A finished one is archived so its credit stays used. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: spaceId, videoId } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  try {
    await removeReviewVideo(videoId, spaceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return aiVideoErrorResponse(error, "Failed to delete the review video");
  }
}
