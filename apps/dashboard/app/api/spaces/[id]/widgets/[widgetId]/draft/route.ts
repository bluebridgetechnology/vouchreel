import { NextResponse } from "next/server";
import { requireSpaceOwner } from "@/lib/ai-video/access";
import { internalError, notFound, validationError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { updateWidgetConfigSchema } from "@/lib/validations/widget-config";
import { discardDraft, getWidget, saveDraft } from "@/lib/widgets/service";

interface RouteParams {
  params: Promise<{ id: string; widgetId: string }>;
}

/** PUT /api/spaces/[id]/widgets/[widgetId]/draft: saves the editor's unpublished changes. Visitors are unaffected until Publish. */
export async function PUT(request: Request, { params }: RouteParams) {
  const { id, widgetId } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const validated = updateWidgetConfigSchema.safeParse(await request.json());
    if (!validated.success) return validationError("Validation failed", validated.error.flatten().fieldErrors);
    if (!(await getWidget(id, widgetId))) return notFound("Widget not found");
    await saveDraft(widgetId, validated.data);
    return NextResponse.json({ saved: true });
  } catch (error) {
    log.error("Failed to save widget draft:", error);
    return internalError("Failed to save widget draft");
  }
}

/** DELETE /api/spaces/[id]/widgets/[widgetId]/draft: throws the unpublished changes away. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id, widgetId } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    if (!(await getWidget(id, widgetId))) return notFound("Widget not found");
    await discardDraft(widgetId);
    return NextResponse.json({ discarded: true });
  } catch (error) {
    log.error("Failed to discard widget draft:", error);
    return internalError("Failed to discard widget draft");
  }
}
