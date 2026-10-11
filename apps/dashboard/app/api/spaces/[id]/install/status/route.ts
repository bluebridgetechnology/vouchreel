import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSpaceOwner } from "@/lib/ai-video/access";
import { internalError, notFound, validationError } from "@/lib/api/errors";
import { getSeenOn } from "@/lib/install/status";
import { log } from "@/lib/log";
import { getWidget } from "@/lib/widgets/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const querySchema = z.object({ widgetId: z.string().uuid().optional() });

/**
 * GET /api/spaces/[id]/install/status?widgetId=
 * Where the space's widgets (or one widget) have been shown to real visitors in the last 30 days.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  const parsed = querySchema.safeParse({ widgetId: new URL(request.url).searchParams.get("widgetId") ?? undefined });
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);

  try {
    if (parsed.data.widgetId && !(await getWidget(id, parsed.data.widgetId))) return notFound("Widget not found");
    return NextResponse.json({ seen: await getSeenOn(id, { widgetId: parsed.data.widgetId }) });
  } catch (error) {
    log.error("Failed to read install status:", error);
    return internalError("Failed to read install status");
  }
}
