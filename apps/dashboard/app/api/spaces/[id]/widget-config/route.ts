import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { requireSpaceOwner } from "@/lib/ai-video/access";
import { internalError, validationError } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { updateWidgetConfigSchema } from "@/lib/validations/widget-config";
import { ensurePrimaryWidget, publishWidget, widgetView } from "@/lib/widgets/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * These two routes are the single-widget API: they mean the space's primary widget (its first one). A space
 * can have several widgets (see /api/spaces/[id]/widgets); the routes here keep working unchanged for
 * everything that only knows about one.
 */

async function spaceSummary(id: string) {
  const [space] = await db.select({ id: spaces.id, name: spaces.name, embedKey: spaces.embedKey }).from(spaces).where(eq(spaces.id, id));
  return space;
}

/**
 * GET /api/spaces/[id]/widget-config
 * Returns the primary widget's configuration, and its unpublished draft if there is one.
 * If the space has no widget yet, creates the default one.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const widget = await ensurePrimaryWidget(id);
    return NextResponse.json(widgetView(widget, await spaceSummary(id)));
  } catch (error) {
    log.error("Failed to fetch widget config:", error);
    return internalError("Failed to fetch widget config");
  }
}

/**
 * PUT /api/spaces/[id]/widget-config
 * Publishes the primary widget's configuration: visitors see it from the next load. Clears any draft.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const validated = updateWidgetConfigSchema.safeParse(await request.json());
    if (!validated.success) return validationError("Validation failed", validated.error.flatten().fieldErrors);

    const widget = await ensurePrimaryWidget(id);
    const saved = await publishWidget(widget.id, validated.data);
    const { draftConfig: _draft, ...widgetConfig } = saved;
    return NextResponse.json({ widgetConfig, space: await spaceSummary(id) });
  } catch (error) {
    log.error("Failed to update widget config:", error);
    return internalError("Failed to update widget config");
  }
}
