import { NextResponse } from "next/server";
import { requireSpaceOwner } from "@/lib/ai-video/access";
import { internalError, validationError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { updateWidgetConfigSchema } from "@/lib/validations/widget-config";
import { discardDraft, ensurePrimaryWidget, saveDraft } from "@/lib/widgets/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/spaces/[id]/widget-config/draft
 * Saves the editor's unpublished changes to the primary widget (the editor autosaves here). The live widget
 * is untouched until the owner publishes with PUT /api/spaces/[id]/widget-config.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const validated = updateWidgetConfigSchema.safeParse(await request.json());
    if (!validated.success) return validationError("Validation failed", validated.error.flatten().fieldErrors);
    const widget = await ensurePrimaryWidget(id);
    await saveDraft(widget.id, validated.data);
    return NextResponse.json({ saved: true });
  } catch (error) {
    log.error("Failed to save widget draft:", error);
    return internalError("Failed to save widget draft");
  }
}

/**
 * DELETE /api/spaces/[id]/widget-config/draft
 * Throws the unpublished changes away; the editor goes back to the live config.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const widget = await ensurePrimaryWidget(id);
    await discardDraft(widget.id);
    return NextResponse.json({ discarded: true });
  } catch (error) {
    log.error("Failed to discard widget draft:", error);
    return internalError("Failed to discard widget draft");
  }
}
