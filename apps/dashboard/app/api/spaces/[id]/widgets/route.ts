import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { requireSpaceOwner } from "@/lib/ai-video/access";
import { badRequest, internalError, notFound, validationError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { widgetNameSchema } from "@/lib/validations/widget-config";
import { createWidget, enforceWidgetLimit, ensurePrimaryWidget, getWidget, getWidgetQuota, listWidgets, widgetSummary } from "@/lib/widgets/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  name: widgetNameSchema.optional(),
  /** Start from a copy of this widget of the same space (its live settings). */
  duplicateOf: z.string().uuid().optional(),
});

/** GET /api/spaces/[id]/widgets: the space's widgets (oldest first, the first is the primary one), and how many the plan allows. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    await ensurePrimaryWidget(id);
    const [widgets, quota, [space]] = await Promise.all([listWidgets(id), getWidgetQuota(id), db.select({ embedKey: spaces.embedKey }).from(spaces).where(eq(spaces.id, id))]);
    return NextResponse.json({
      widgets: widgets.map(widgetSummary),
      embedKey: space?.embedKey ?? null,
      quota: quota ? { current: quota.current, limit: Number.isFinite(quota.limit) ? quota.limit : null, allowed: quota.allowed } : null,
    });
  } catch (error) {
    log.error("Failed to list widgets:", error);
    return internalError("Failed to list widgets");
  }
}

/** POST /api/spaces/[id]/widgets: adds a widget (off until published), within the owner's plan. */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return badRequest("The request body is not valid JSON");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);

  try {
    const blocked = await enforceWidgetLimit(id);
    if (blocked) return blocked;

    let copyOf;
    if (parsed.data.duplicateOf) {
      copyOf = (await getWidget(id, parsed.data.duplicateOf)) ?? undefined;
      if (!copyOf) return notFound("The widget to copy was not found in this space");
    }
    const widgets = await listWidgets(id);
    const name = parsed.data.name ?? (copyOf ? `${copyOf.name} copy`.slice(0, 60) : `Widget ${widgets.length + 1}`);
    const widget = await createWidget(id, { name, copyOf });
    return NextResponse.json({ widget: widgetSummary(widget) }, { status: 201 });
  } catch (error) {
    log.error("Failed to create widget:", error);
    return internalError("Failed to create widget");
  }
}
