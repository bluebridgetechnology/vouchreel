import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, widgetConfigs } from "@/lib/db/schema";
import {
  DEFAULT_WIDGET_CONFIG,
  normalizeTheme,
  updateWidgetConfigSchema,
} from "@/lib/validations/widget-config";
import {
  unauthorized,
  forbidden,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/spaces/[id]/widget-config
 * Returns the widget configuration for the specified space.
 * If no config exists, creates and returns the default configuration.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id } = await params;

  try {
    const [space] = await db
      .select()
      .from(spaces)
      .where(eq(spaces.id, id));

    if (!space) {
      return notFound("Space not found");
    }

    if (space.ownerId !== session.user.id) {
      return forbidden("Forbidden: You do not own this space");
    }

    const [existingConfig] = await db
      .select()
      .from(widgetConfigs)
      .where(eq(widgetConfigs.spaceId, space.id));

    if (existingConfig) {
      const theme = normalizeTheme(existingConfig.theme);

      const triggerValue =
        existingConfig.triggerValue &&
        typeof existingConfig.triggerValue === "object" &&
        Object.keys(existingConfig.triggerValue).length > 0
          ? existingConfig.triggerValue
          : DEFAULT_WIDGET_CONFIG.triggerValue;

      const pagesIncluded =
        existingConfig.pagesIncluded && existingConfig.pagesIncluded.length > 0
          ? existingConfig.pagesIncluded
          : DEFAULT_WIDGET_CONFIG.pagesIncluded;

      const { draftConfig, ...live } = existingConfig;
      const draft = draftConfig ? updateWidgetConfigSchema.safeParse(draftConfig) : null;

      return NextResponse.json({
        widgetConfig: {
          ...live,
          template: existingConfig.template || DEFAULT_WIDGET_CONFIG.template,
          theme,
          triggerValue,
          pagesIncluded,
        },
        // Unpublished edits, when there are any (and still valid), for the editor to resume
        draft: draft?.success ? { ...draft.data, theme: normalizeTheme(draft.data.theme) } : null,
        space: {
          id: space.id,
          name: space.name,
          embedKey: space.embedKey,
        },
      });
    }

    // Create default widget config if none exists
    const [newConfig] = await db
      .insert(widgetConfigs)
      .values({
        spaceId: space.id,
        ...DEFAULT_WIDGET_CONFIG,
      })
      .returning();

    return NextResponse.json({
      widgetConfig: newConfig,
      space: {
        id: space.id,
        name: space.name,
        embedKey: space.embedKey,
      },
    });
  } catch (error) {
    log.error("Failed to fetch widget config:", error);
    return internalError("Failed to fetch widget config");
  }
}

/**
 * PUT /api/spaces/[id]/widget-config
 * Publishes a widget configuration: visitors see it from the next load. Clears any draft.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id } = await params;

  try {
    const [space] = await db
      .select()
      .from(spaces)
      .where(eq(spaces.id, id));

    if (!space) {
      return notFound("Space not found");
    }

    if (space.ownerId !== session.user.id) {
      return forbidden("Forbidden: You do not own this space");
    }

    const body = await request.json();
    const validated = updateWidgetConfigSchema.safeParse(body);

    if (!validated.success) {
      return validationError(
        "Validation failed",
        validated.error.flatten().fieldErrors
      );
    }

    const [existing] = await db
      .select()
      .from(widgetConfigs)
      .where(eq(widgetConfigs.spaceId, space.id));

    let savedConfig;

    if (existing) {
      const [updated] = await db
        .update(widgetConfigs)
        .set({
          template: validated.data.template,
          position: validated.data.position,
          theme: validated.data.theme,
          triggerType: validated.data.triggerType,
          triggerValue: validated.data.triggerValue,
          pagesIncluded: validated.data.pagesIncluded,
          pagesExcluded: validated.data.pagesExcluded,
          autoplayPreview: validated.data.autoplayPreview,
          // Publishing makes the draft the live config, so there is nothing left unpublished
          draftConfig: null,
          publishedAt: new Date(),
        })
        .where(eq(widgetConfigs.id, existing.id))
        .returning();

      savedConfig = updated;
    } else {
      const [inserted] = await db
        .insert(widgetConfigs)
        .values({
          spaceId: space.id,
          ...validated.data,
          publishedAt: new Date(),
        })
        .returning();

      savedConfig = inserted;
    }

    return NextResponse.json({
      widgetConfig: savedConfig,
      space: {
        id: space.id,
        name: space.name,
        embedKey: space.embedKey,
      },
    });
  } catch (error) {
    log.error("Failed to update widget config:", error);
    return internalError("Failed to update widget config");
  }
}
