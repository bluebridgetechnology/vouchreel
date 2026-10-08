import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { widgetConfigs } from "@/lib/db/schema";
import { DEFAULT_WIDGET_CONFIG, updateWidgetConfigSchema } from "@/lib/validations/widget-config";
import { requireSpaceOwner } from "@/lib/ai-video/access";
import { validationError, internalError } from "@/lib/api/errors";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/spaces/[id]/widget-config/draft
 * Saves the editor's unpublished changes (the editor autosaves here). The live widget is untouched until
 * the owner publishes with PUT /api/spaces/[id]/widget-config.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const validated = updateWidgetConfigSchema.safeParse(await request.json());
    if (!validated.success) {
      return validationError("Validation failed", validated.error.flatten().fieldErrors);
    }

    const [existing] = await db.select({ id: widgetConfigs.id }).from(widgetConfigs).where(eq(widgetConfigs.spaceId, id));
    if (existing) {
      await db.update(widgetConfigs).set({ draftConfig: validated.data }).where(eq(widgetConfigs.id, existing.id));
    } else {
      // No live config yet: the live one starts as the defaults, so the draft is still unpublished
      await db.insert(widgetConfigs).values({ spaceId: id, ...DEFAULT_WIDGET_CONFIG, draftConfig: validated.data });
    }
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
    await db.update(widgetConfigs).set({ draftConfig: null }).where(eq(widgetConfigs.spaceId, id));
    return NextResponse.json({ discarded: true });
  } catch (error) {
    log.error("Failed to discard widget draft:", error);
    return internalError("Failed to discard widget draft");
  }
}
