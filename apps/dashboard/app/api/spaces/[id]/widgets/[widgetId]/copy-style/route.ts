import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSpaceOwner } from "@/lib/ai-video/access";
import { badRequest, internalError, notFound, validationError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { copyStyleToWidgets, getWidget, listCopyTargets } from "@/lib/widgets/service";

interface RouteParams {
  params: Promise<{ id: string; widgetId: string }>;
}

const bodySchema = z.object({
  targets: z.array(z.object({ spaceId: z.string().uuid(), widgetId: z.string().uuid() })).min(1, "Choose at least one widget").max(50),
});

/** GET .../copy-style: the user's other widgets, grouped by space, that this widget's style could be copied onto. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id, widgetId } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    if (!(await getWidget(id, widgetId))) return notFound("Widget not found");
    return NextResponse.json({ spaces: await listCopyTargets(owner.userId, id, widgetId) });
  } catch (error) {
    log.error("Failed to list style targets:", error);
    return internalError("Failed to list widgets");
  }
}

/**
 * POST .../copy-style  { targets: [{ spaceId, widgetId }] }
 * Copies this widget's look (its live settings) into the targets' drafts. Nothing goes live until each is
 * published. Targets must be in spaces the user owns; any others are skipped.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id, widgetId } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("The request body is not valid JSON");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);

  try {
    const source = await getWidget(id, widgetId);
    if (!source) return notFound("Widget not found");
    const copied = await copyStyleToWidgets(owner.userId, source, parsed.data.targets);
    return NextResponse.json({ copied, skipped: parsed.data.targets.length - copied.length });
  } catch (error) {
    log.error("Failed to copy widget style:", error);
    return internalError("Failed to copy the style");
  }
}
