import { NextResponse } from "next/server";
import { requireSpaceOwner } from "@/lib/ai-video/access";
import { internalError, notFound } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { getWidgetPerformance } from "@/lib/widgets/performance";
import { getWidget } from "@/lib/widgets/service";

interface RouteParams {
  params: Promise<{ id: string; widgetId: string }>;
}

/** GET /api/spaces/[id]/widgets/[widgetId]/performance: views, plays and clicks for the last 30 days, by day, and the 30 before. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id, widgetId } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const widget = await getWidget(id, widgetId);
    if (!widget) return notFound("Widget not found");
    return NextResponse.json({
      ...(await getWidgetPerformance(id, widgetId)),
      publishedAt: widget.publishedAt?.toISOString() ?? null,
      isLive: widget.isLive,
    });
  } catch (error) {
    log.error("Failed to read widget performance:", error);
    return internalError("Failed to read the numbers");
  }
}
