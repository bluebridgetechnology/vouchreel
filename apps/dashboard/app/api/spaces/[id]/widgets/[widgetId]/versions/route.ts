import { NextResponse } from "next/server";
import { requireSpaceOwner } from "@/lib/ai-video/access";
import { internalError, notFound } from "@/lib/api/errors";
import { log } from "@/lib/log";
import { changedAreas, sameSettings } from "@/lib/widgets/history";
import { getWidget, listVersions, widgetView } from "@/lib/widgets/service";
import { updateWidgetConfigSchema } from "@/lib/validations/widget-config";

interface RouteParams {
  params: Promise<{ id: string; widgetId: string }>;
}

/**
 * GET /api/spaces/[id]/widgets/[widgetId]/versions
 * The kept versions of the widget, newest first, each with what changed since the one before it and whether it is
 * what visitors see now. Restoring one is the editor's job: it loads the settings as unpublished changes.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id, widgetId } = await params;
  const owner = await requireSpaceOwner(id);
  if ("response" in owner) return owner.response;

  try {
    const widget = await getWidget(id, widgetId);
    if (!widget) return notFound("Widget not found");
    const { widgetConfig: live } = widgetView(widget, { id, name: "", embedKey: "" });
    const liveSettings = {
      template: live.template,
      position: live.position,
      theme: live.theme,
      triggerType: live.triggerType,
      triggerValue: live.triggerValue,
      pagesIncluded: live.pagesIncluded,
      pagesExcluded: live.pagesExcluded ?? [],
      autoplayPreview: live.autoplayPreview,
    };
    const rows = await listVersions(widgetId);

    const versions = rows.flatMap((row, i) => {
      const parsed = updateWidgetConfigSchema.safeParse(row.config);
      if (!parsed.success) return []; // a version from an older shape that no longer validates is not offered
      const older = rows[i + 1] ? updateWidgetConfigSchema.safeParse(rows[i + 1].config) : null;
      return [
        {
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          source: row.source,
          config: parsed.data,
          changed: older?.success ? changedAreas(older.data, parsed.data) : null,
          isLive: sameSettings(parsed.data, liveSettings),
        },
      ];
    });
    return NextResponse.json({ versions });
  } catch (error) {
    log.error("Failed to list widget versions:", error);
    return internalError("Failed to load the history");
  }
}
