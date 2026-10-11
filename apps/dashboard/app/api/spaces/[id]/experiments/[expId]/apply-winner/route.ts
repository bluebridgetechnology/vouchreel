import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import {
  unauthorized,
  forbidden,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { experiments, spaces, widgetConfigs } from "@/lib/db/schema";
import { getExperimentTarget, recordVersion } from "@/lib/widgets/service";
import { DEFAULT_WIDGET_CONFIG } from "@/lib/validations/widget-config";
import { resolveStyleVariant } from "@/lib/experiments/style";
import { applyWinnerSchema } from "@/lib/validations/experiments";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string; expId: string }>;
}

async function verifySpaceAccess(spaceId: string, userId: string) {
  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, spaceId));

  if (!space) {
    return { notFound: true };
  }

  if (space.ownerId !== userId) {
    return { forbidden: true };
  }

  return { space };
}

/**
 * POST /api/spaces/[id]/experiments/[expId]/apply-winner
 * Applies the winning variant's configuration to the widget the experiment ran on: the first one visitors see.
 * Sets the experiment status to 'completed', winnerVariantIndex, and endedAt.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized("Unauthorized");
  }

  const { id: spaceId, expId } = await params;

  try {
    const access = await verifySpaceAccess(spaceId, session.user.id);
    if (access.notFound) return notFound("Space not found");
    if (access.forbidden) return forbidden("Forbidden: You do not own this space");

    const [experiment] = await db
      .select()
      .from(experiments)
      .where(and(eq(experiments.id, expId), eq(experiments.spaceId, spaceId)));

    if (!experiment) {
      return notFound("Experiment not found");
    }

    const body = await request.json();
    const validated = applyWinnerSchema.safeParse(body);

    if (!validated.success) {
      return validationError(
        "Validation failed",
        validated.error.flatten().fieldErrors
      );
    }

    const variants = experiment.variants || [];
    let winnerIndex = -1;

    if (validated.data.variantIndex !== undefined) {
      winnerIndex = validated.data.variantIndex;
    } else if (validated.data.variantId) {
      winnerIndex = variants.findIndex((v) => v.id === validated.data.variantId);
    }

    if (winnerIndex < 0 || winnerIndex >= variants.length) {
      return validationError("Invalid winner variant index or id", {
        variant: ["Specified variant does not exist in this experiment"],
      });
    }

    const winningVariant = variants[winnerIndex];
    const vConfig = winningVariant.config || {};

    // The experiment runs on the first widget visitors see (see /api/widget), so that is the one it changes
    const existingWidgetConfig = await getExperimentTarget(spaceId);

    const widgetUpdates: Partial<typeof widgetConfigs.$inferInsert> = {};

    if (experiment.type === "trigger") {
      const triggerType =
        (vConfig.triggerType as any) ||
        (vConfig.type as any) ||
        ((vConfig.trigger as any)?.type as any);

      const triggerValue =
        (vConfig.triggerValue as Record<string, unknown>) ||
        (vConfig.value as Record<string, unknown>) ||
        ((vConfig.trigger as any)?.value as Record<string, unknown>);

      if (triggerType) widgetUpdates.triggerType = triggerType;
      if (triggerValue) widgetUpdates.triggerValue = triggerValue;
    } else if (experiment.type === "position") {
      const position =
        (vConfig.position as any) ||
        (vConfig.value as any) ||
        (typeof vConfig === "string" ? vConfig : undefined);

      if (position) widgetUpdates.position = position;
    } else if (experiment.type === "template") {
      const template =
        (vConfig.template as any) ||
        (vConfig.value as any) ||
        (typeof vConfig === "string" ? vConfig : undefined);

      if (template) widgetUpdates.template = template;
    } else if (experiment.type === "style") {
      // The winner's layout and look, on top of the widget as published. Goes live at once, like the other types.
      const resolved = resolveStyleVariant(
        { template: existingWidgetConfig?.template ?? DEFAULT_WIDGET_CONFIG.template, theme: existingWidgetConfig?.theme },
        vConfig
      );
      widgetUpdates.template = resolved.template;
      widgetUpdates.theme = resolved.theme;
    }

    // Persist widget config update
    let updatedWidgetConfig;
    if (existingWidgetConfig) {
      const [saved] = await db
        .update(widgetConfigs)
        .set(widgetUpdates)
        .where(eq(widgetConfigs.id, existingWidgetConfig.id))
        .returning();
      updatedWidgetConfig = saved;
      await recordVersion(existingWidgetConfig, saved, "experiment");
    } else {
      const [saved] = await db
        .insert(widgetConfigs)
        .values({
          spaceId,
          ...DEFAULT_WIDGET_CONFIG,
          ...widgetUpdates,
        })
        .returning();
      updatedWidgetConfig = saved;
    }

    // Complete experiment and set winner
    const [updatedExp] = await db
      .update(experiments)
      .set({
        status: "completed",
        winnerVariantIndex: winnerIndex,
        endedAt: new Date(),
      })
      .where(and(eq(experiments.id, expId), eq(experiments.spaceId, spaceId)))
      .returning();

    return NextResponse.json({
      success: true,
      experiment: updatedExp,
      widgetConfig: updatedWidgetConfig,
      winningVariant,
    });
  } catch (error) {
    log.error("Failed to apply winning variant:", error);
    return internalError("Failed to apply winning variant");
  }
}
