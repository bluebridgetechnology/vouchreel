import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { withApiKeyAuth, apiV1Options } from "@/lib/api/v1-handler";
import { db } from "@/lib/db";
import { spaces, testimonials } from "@/lib/db/schema";
import { apiError, forbidden, notFound } from "@/lib/api/errors";
import { log } from "@/lib/log";

export const OPTIONS = apiV1Options();

interface RouteParams {
  id: string;
}

/**
 * GET /api/v1/spaces/[id]
 * Fetch space details by ID. Must match the space bound to the API key.
 */
export const GET = withApiKeyAuth<RouteParams>(
  async (request, { apiKey, params }) => {
    if (!params?.id) {
      return apiError(400, "BAD_REQUEST", "Space ID is required");
    }

    if (params.id !== apiKey.spaceId) {
      return forbidden("Forbidden: API key does not have access to this space");
    }

    try {
      const [space] = await db
        .select({
          id: spaces.id,
          name: spaces.name,
          embedKey: spaces.embedKey,
          createdAt: spaces.createdAt,
        })
        .from(spaces)
        .where(eq(spaces.id, apiKey.spaceId));

      if (!space) {
        return notFound("Space not found");
      }

      const [testimonialCount] = await db
        .select({ value: count() })
        .from(testimonials)
        .where(eq(testimonials.spaceId, apiKey.spaceId));

      return NextResponse.json({
        space: {
          ...space,
          testimonialCount: testimonialCount?.value ?? 0,
        },
      });
    } catch (error) {
      log.error("v1 GET /spaces/[id] error:", error);
      return apiError(500, "INTERNAL_ERROR", "Failed to fetch space");
    }
  }
);
