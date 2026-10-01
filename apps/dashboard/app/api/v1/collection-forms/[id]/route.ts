import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { withApiKeyAuth, apiV1Options } from "@/lib/api/v1-handler";
import { db } from "@/lib/db";
import { collectionForms } from "@/lib/db/schema";
import { apiError, notFound } from "@/lib/api/errors";

export const OPTIONS = apiV1Options();

interface RouteParams {
  id: string;
}

/**
 * GET /api/v1/collection-forms/[id]
 * Fetch a single collection form by ID.
 */
export const GET = withApiKeyAuth<RouteParams>(
  async (request, { apiKey, params }) => {
    if (!params?.id) {
      return apiError(400, "BAD_REQUEST", "Collection form ID is required");
    }

    const host = request.headers.get("host") || "app.vouchreel.com";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const origin = `${protocol}://${host}`;

    try {
      const [form] = await db
        .select({
          id: collectionForms.id,
          title: collectionForms.title,
          promptText: collectionForms.promptText,
          incentiveType: collectionForms.incentiveType,
          incentiveValue: collectionForms.incentiveValue,
          branding: collectionForms.branding,
          slug: collectionForms.slug,
          isActive: collectionForms.isActive,
          createdAt: collectionForms.createdAt,
        })
        .from(collectionForms)
        .where(
          and(
            eq(collectionForms.id, params.id),
            eq(collectionForms.spaceId, apiKey.spaceId)
          )
        );

      if (!form) {
        return notFound("Collection form not found");
      }

      return NextResponse.json({
        collectionForm: {
          ...form,
          collectionUrl: `${origin}/collect/${form.slug}`,
        },
      });
    } catch (error) {
      console.error("v1 GET /collection-forms/[id] error:", error);
      return apiError(500, "INTERNAL_ERROR", "Failed to fetch collection form");
    }
  }
);
