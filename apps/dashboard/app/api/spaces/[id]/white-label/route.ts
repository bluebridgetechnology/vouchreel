import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { apiError, forbidden, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { whiteLabelSettings } from "@/lib/db/schema";
import { whiteLabelSettingsSchema } from "@/lib/validations/white-label";
import { verifySpaceAccess } from "@/lib/auth/permissions";
import { canAccess } from "@/lib/auth/feature-gate";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const DEFAULT_WHITE_LABEL_SETTINGS = {
  logoUrl: null,
  customDomain: null,
  cnameVerified: false,
  removeBranding: false,
  customEmailSender: null,
};

/**
 * GET /api/spaces/[id]/white-label
 * Fetches the white-label settings for a given space.
 * Accessible to owner, editor, and viewer.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id } = await params;
  const authCheck = await verifySpaceAccess(session.user.id, id, "viewer");
  if (!authCheck.success) {
    return authCheck.errorResponse;
  }

  const spaceOwnerId = authCheck.access.space.ownerId;
  const isEntitled = await canAccess(spaceOwnerId, "white-label");

  try {
    const [settings] = await db
      .select()
      .from(whiteLabelSettings)
      .where(eq(whiteLabelSettings.spaceId, id));

    return NextResponse.json({
      whiteLabelSettings: settings || {
        spaceId: id,
        ...DEFAULT_WHITE_LABEL_SETTINGS,
      },
      isEntitled,
    });
  } catch (error) {
    log.error("Failed to fetch white-label settings:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch white-label settings");
  }
}

/**
 * PUT /api/spaces/[id]/white-label
 * Updates white-label branding configuration for a space.
 * Requires editor or owner role, plus Agency entitlement for removeBranding / customDomain.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id } = await params;
  const authCheck = await verifySpaceAccess(session.user.id, id, "editor");
  if (!authCheck.success) {
    return authCheck.errorResponse;
  }

  const spaceOwnerId = authCheck.access.space.ownerId;
  const isEntitled = await canAccess(spaceOwnerId, "white-label");

  try {
    const body = await request.json();
    const validated = whiteLabelSettingsSchema.safeParse(body);

    if (!validated.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: validated.error.flatten().fieldErrors,
      });
    }

    const data = validated.data;

    // Feature gating check: if trying to remove branding or set custom domain, must have entitlement
    if (!isEntitled && (data.removeBranding || data.customDomain)) {
      return forbidden(
        "White-label branding and custom domains require an Agency plan. Please upgrade to enable these features."
      );
    }

    const [existing] = await db
      .select({ id: whiteLabelSettings.id })
      .from(whiteLabelSettings)
      .where(eq(whiteLabelSettings.spaceId, id));

    const updatePayload = {
      logoUrl: data.logoUrl !== undefined ? data.logoUrl : null,
      customDomain: data.customDomain ? data.customDomain : null,
      cnameVerified: data.cnameVerified ?? false,
      removeBranding: isEntitled ? (data.removeBranding ?? false) : false,
      customEmailSender: data.customEmailSender ? data.customEmailSender : null,
      updatedAt: new Date(),
    };

    let resultSettings;
    if (existing) {
      const [updated] = await db
        .update(whiteLabelSettings)
        .set(updatePayload)
        .where(eq(whiteLabelSettings.id, existing.id))
        .returning();
      resultSettings = updated;
    } else {
      const [inserted] = await db
        .insert(whiteLabelSettings)
        .values({
          spaceId: id,
          ...updatePayload,
        })
        .returning();
      resultSettings = inserted;
    }

    return NextResponse.json({
      whiteLabelSettings: resultSettings,
      isEntitled,
    });
  } catch (error) {
    log.error("Failed to update white-label settings:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to update white-label settings");
  }
}
