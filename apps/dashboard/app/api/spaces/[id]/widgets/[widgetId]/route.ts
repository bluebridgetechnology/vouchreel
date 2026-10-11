import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { requireSpaceOwner } from "@/lib/ai-video/access";
import { apiError, badRequest, internalError, notFound, validationError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { updateWidgetConfigSchema, widgetNameSchema } from "@/lib/validations/widget-config";
import { deleteWidget, getWidget, publishWidget, renameWidget, setWallEnabled, setWidgetLive, widgetSummary, widgetView } from "@/lib/widgets/service";

interface RouteParams {
  params: Promise<{ id: string; widgetId: string }>;
}

const patchSchema = z
  .object({ name: widgetNameSchema.optional(), isLive: z.boolean().optional(), wallEnabled: z.boolean().optional() })
  .refine((v) => v.name !== undefined || v.isLive !== undefined || v.wallEnabled !== undefined, { message: "Nothing to change" });

/** GET /api/spaces/[id]/widgets/[widgetId]: the widget's live settings, its unpublished draft (if any) and its details. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id, widgetId } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const widget = await getWidget(id, widgetId);
    if (!widget) return notFound("Widget not found");
    const [space] = await db.select({ id: spaces.id, name: spaces.name, embedKey: spaces.embedKey }).from(spaces).where(eq(spaces.id, id));
    return NextResponse.json(widgetView(widget, space));
  } catch (error) {
    log.error("Failed to fetch widget:", error);
    return internalError("Failed to fetch widget");
  }
}

/** PUT /api/spaces/[id]/widgets/[widgetId]: publishes the settings. They go live for visitors, the draft is cleared. */
export async function PUT(request: Request, { params }: RouteParams) {
  const { id, widgetId } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const validated = updateWidgetConfigSchema.safeParse(await request.json());
    if (!validated.success) return validationError("Validation failed", validated.error.flatten().fieldErrors);
    if (!(await getWidget(id, widgetId))) return notFound("Widget not found");
    const saved = await publishWidget(widgetId, validated.data);
    return NextResponse.json({ widget: widgetSummary(saved) });
  } catch (error) {
    log.error("Failed to publish widget:", error);
    return internalError("Failed to publish widget");
  }
}

/** PATCH /api/spaces/[id]/widgets/[widgetId]: renames the widget, turns it on or off for visitors, and/or turns its own public page on or off. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id, widgetId } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("The request body is not valid JSON");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);

  try {
    let widget = await getWidget(id, widgetId);
    if (!widget) return notFound("Widget not found");
    if (parsed.data.name !== undefined) widget = (await renameWidget(id, widgetId, parsed.data.name)) ?? widget;
    if (parsed.data.isLive !== undefined) widget = (await setWidgetLive(id, widgetId, parsed.data.isLive)) ?? widget;
    if (parsed.data.wallEnabled !== undefined) {
      const result = await setWallEnabled(id, widgetId, parsed.data.wallEnabled);
      if (result === "not_inline") return apiError(409, "BAD_REQUEST", "Only widgets that sit in a page can have their own page. This layout floats in a corner.", { details: { reason: "not_inline" } });
      widget = result ?? widget;
    }
    return NextResponse.json({ widget: widgetSummary(widget) });
  } catch (error) {
    log.error("Failed to update widget:", error);
    return internalError("Failed to update widget");
  }
}

/** DELETE /api/spaces/[id]/widgets/[widgetId]: removes a widget. A space always keeps at least one. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id, widgetId } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const result = await deleteWidget(id, widgetId);
    if (result === "not_found") return notFound("Widget not found");
    if (result === "last") return apiError(409, "BAD_REQUEST", "A space needs at least one widget. Turn it off instead, or add another first.", { details: { reason: "last_widget" } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    log.error("Failed to delete widget:", error);
    return internalError("Failed to delete widget");
  }
}
