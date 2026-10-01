import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { withApiKeyAuth, apiV1Options } from "@/lib/api/v1-handler";
import { db } from "@/lib/db";
import { collectionForms, submissions } from "@/lib/db/schema";
import { apiError, notFound } from "@/lib/api/errors";
import { paginationV1Schema } from "@/lib/validations/v1-api";

export const OPTIONS = apiV1Options();

interface RouteParams {
  id: string;
}

/**
 * GET /api/v1/collection-forms/[id]/submissions
 * Lists submissions submitted to a specific collection form.
 */
export const GET = withApiKeyAuth<RouteParams>(
  async (request, { apiKey, params }) => {
    if (!params?.id) {
      return apiError(400, "BAD_REQUEST", "Collection form ID is required");
    }

    const url = new URL(request.url);
    const pagination = paginationV1Schema.safeParse({
      page: url.searchParams.get("page") ?? 1,
      limit: url.searchParams.get("limit") ?? 20,
    });

    const { page, limit } = pagination.success
      ? pagination.data
      : { page: 1, limit: 20 };
    const offset = (page - 1) * limit;

    try {
      // Verify form belongs to API key's space
      const [form] = await db
        .select({ id: collectionForms.id })
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

      const items = await db
        .select({
          id: submissions.id,
          type: submissions.type,
          videoUrl: submissions.videoUrl,
          text: submissions.text,
          customerName: submissions.customerName,
          customerEmail: submissions.customerEmail,
          status: submissions.status,
          thumbnailUrl: submissions.thumbnailUrl,
          durationSeconds: submissions.durationSeconds,
          processingStatus: submissions.processingStatus,
          createdAt: submissions.createdAt,
        })
        .from(submissions)
        .where(eq(submissions.formId, params.id))
        .orderBy(desc(submissions.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({
        submissions: items,
        pagination: {
          page,
          limit,
          count: items.length,
        },
      });
    } catch (error) {
      console.error("v1 GET /collection-forms/[id]/submissions error:", error);
      return apiError(500, "INTERNAL_ERROR", "Failed to fetch submissions");
    }
  }
);
