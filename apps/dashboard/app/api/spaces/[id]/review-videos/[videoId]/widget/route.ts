import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/errors";
import { aiVideoErrorResponse, requireSpaceOwner } from "@/lib/ai-video/access";
import { setVideoInWidget } from "@/lib/widget-videos";

interface RouteParams {
  params: Promise<{ id: string; videoId: string }>;
}

const bodySchema = z.object({ show: z.boolean() });

/** Shows this video in the owner's embedded widget, or stops showing it. Only a finished video can be shown. */
export async function PUT(request: Request, { params }: RouteParams) {
  const { id: spaceId, videoId } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Send { show: true } or { show: false }");

  try {
    await setVideoInWidget("review", videoId, spaceId, parsed.data.show);
    return NextResponse.json({ showInWidget: parsed.data.show });
  } catch (error) {
    return aiVideoErrorResponse(error, "Could not update the widget setting");
  }
}
