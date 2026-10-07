import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionForms, spaces, whiteLabelSettings } from "@/lib/db/schema";
import { badRequest, internalError, notFound } from "@/lib/api/errors";
import { canAccess } from "@/lib/auth/feature-gate";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  if (!slug || slug.length > 100) {
    return badRequest("Invalid collection link");
  }

  try {
    const [form] = await db
      .select({
        title: collectionForms.title,
        promptText: collectionForms.promptText,
        incentiveType: collectionForms.incentiveType,
        incentiveValue: collectionForms.incentiveValue,
        branding: collectionForms.branding,
        collectModes: collectionForms.collectModes,
        spaceId: collectionForms.spaceId,
      })
      .from(collectionForms)
      .where(and(eq(collectionForms.slug, slug), eq(collectionForms.isActive, true)));

    if (!form) return notFound("Collection form not found");

    // Fetch space & white-label settings
    const [space] = await db
      .select({ ownerId: spaces.ownerId })
      .from(spaces)
      .where(eq(spaces.id, form.spaceId));

    const [wlRecord] = await db
      .select()
      .from(whiteLabelSettings)
      .where(eq(whiteLabelSettings.spaceId, form.spaceId));

    const isWhiteLabelEntitled = space ? await canAccess(space.ownerId, "white-label") : false;
    const effectiveLogo =
      form.branding?.logoUrl ||
      (isWhiteLabelEntitled && wlRecord?.logoUrl ? wlRecord.logoUrl : null);
    const removeBranding = isWhiteLabelEntitled ? (wlRecord?.removeBranding ?? false) : false;

    return NextResponse.json({
      collectionForm: {
        title: form.title,
        promptText: form.promptText,
        incentiveType: form.incentiveType,
        incentiveValue: form.incentiveValue,
        collectModes: form.collectModes,
        branding: {
          accentColor: form.branding?.accentColor,
          logoUrl: effectiveLogo,
          removeBranding,
        },
      },
    });
  } catch (error) {
    log.error("Failed to load public collection form:", error);
    return internalError("Failed to load collection form");
  }
}
