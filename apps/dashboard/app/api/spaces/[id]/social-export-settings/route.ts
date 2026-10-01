import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { socialExportSettings, spaces } from "@/lib/db/schema";
import { getSubscriptionLimits } from "@/lib/payments/subscription";
import { updateSocialExportSettingsSchema } from "@/lib/validations/social-export";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function verifySpaceOwner(spaceId: string, userId: string) {
  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, spaceId));

  if (!space) {
    return { error: [404, "NOT_FOUND", "Space not found"] as const };
  }

  if (space.ownerId !== userId) {
    return {
      error: [403, "FORBIDDEN", "Forbidden: You do not own this space"] as const,
    };
  }

  return { space };
}

export async function GET(_: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id: spaceId } = await params;
  const auth = await verifySpaceOwner(spaceId, session.user.id);
  if (auth.error) {
    return apiError(auth.error[0], auth.error[1], auth.error[2]);
  }

  try {
    const [existingSettings] = await db
      .select()
      .from(socialExportSettings)
      .where(eq(socialExportSettings.spaceId, spaceId));

    const limits = await getSubscriptionLimits(session.user.id);

    const settings = existingSettings || {
      id: null,
      spaceId,
      logoUrl: null,
      brandColor: "#6366f1",
      watermarkPosition: "bottom-right",
      showWatermark: true,
      defaultFraming: "blur",
      createdAt: null,
      updatedAt: null,
    };

    return NextResponse.json({
      settings,
      limits: {
        canRemoveWatermark: limits.removeWatermark,
        canCustomizeBranding: limits.canCustomizeBranding,
      },
    });
  } catch (error) {
    console.error("Failed to fetch social export settings:", error);
    return apiError(
      500,
      "INTERNAL_ERROR",
      "Failed to fetch social export settings"
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id: spaceId } = await params;
  const auth = await verifySpaceOwner(spaceId, session.user.id);
  if (auth.error) {
    return apiError(auth.error[0], auth.error[1], auth.error[2]);
  }

  try {
    const body = await request.json();
    const parsed = updateSocialExportSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const limits = await getSubscriptionLimits(session.user.id);

    // If user cannot remove watermark under their subscription tier, enforce showWatermark: true
    let showWatermark = parsed.data.showWatermark ?? true;
    if (!limits.removeWatermark) {
      showWatermark = true;
    }

    const [existing] = await db
      .select({ id: socialExportSettings.id })
      .from(socialExportSettings)
      .where(eq(socialExportSettings.spaceId, spaceId));

    const valuesToSave = {
      spaceId,
      logoUrl: parsed.data.logoUrl || null,
      brandColor: parsed.data.brandColor || "#6366f1",
      watermarkPosition: parsed.data.watermarkPosition || "bottom-right",
      showWatermark,
      defaultFraming: parsed.data.defaultFraming || "blur",
      updatedAt: new Date(),
    };

    let saved;
    if (existing) {
      [saved] = await db
        .update(socialExportSettings)
        .set(valuesToSave)
        .where(eq(socialExportSettings.spaceId, spaceId))
        .returning();
    } else {
      [saved] = await db
        .insert(socialExportSettings)
        .values({
          ...valuesToSave,
          createdAt: new Date(),
        })
        .returning();
    }

    return NextResponse.json({
      settings: saved,
      limits: {
        canRemoveWatermark: limits.removeWatermark,
        canCustomizeBranding: limits.canCustomizeBranding,
      },
    });
  } catch (error) {
    console.error("Failed to update social export settings:", error);
    return apiError(
      500,
      "INTERNAL_ERROR",
      "Failed to update social export settings"
    );
  }
}
