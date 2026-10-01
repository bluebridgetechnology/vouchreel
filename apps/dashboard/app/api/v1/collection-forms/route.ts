import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { withApiKeyAuth, apiV1Options } from "@/lib/api/v1-handler";
import { db } from "@/lib/db";
import { collectionForms } from "@/lib/db/schema";
import { apiError } from "@/lib/api/errors";

export const OPTIONS = apiV1Options();

/**
 * GET /api/v1/collection-forms
 * Lists all active collection forms for the space bound to the API key.
 * Provides public URL for sending to customers (e.g. in Zapier/Make automations).
 */
export const GET = withApiKeyAuth(async (request, { apiKey }) => {
  const host = request.headers.get("host") || "app.vouchreel.com";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const origin = `${protocol}://${host}`;

  try {
    const forms = await db
      .select({
        id: collectionForms.id,
        title: collectionForms.title,
        promptText: collectionForms.promptText,
        incentiveType: collectionForms.incentiveType,
        incentiveValue: collectionForms.incentiveValue,
        slug: collectionForms.slug,
        isActive: collectionForms.isActive,
        createdAt: collectionForms.createdAt,
      })
      .from(collectionForms)
      .where(
        and(
          eq(collectionForms.spaceId, apiKey.spaceId),
          eq(collectionForms.isActive, true)
        )
      )
      .orderBy(desc(collectionForms.createdAt));

    const enriched = forms.map((form) => ({
      ...form,
      collectionUrl: `${origin}/collect/${form.slug}`,
    }));

    return NextResponse.json({ collectionForms: enriched });
  } catch (error) {
    console.error("v1 GET /collection-forms error:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch collection forms");
  }
});
