import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { withApiKeyAuth, apiV1Options } from "@/lib/api/v1-handler";
import { db } from "@/lib/db";
import { spaces, testimonials } from "@/lib/db/schema";
import { apiError } from "@/lib/api/errors";
import { log } from "@/lib/log";

export const OPTIONS = apiV1Options();

/**
 * GET /api/v1/spaces
 * Returns space information for the space bound to the provided API key.
 */
export const GET = withApiKeyAuth(async (request, { apiKey }) => {
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
      return apiError(404, "NOT_FOUND", "Space not found");
    }

    const [testimonialCount] = await db
      .select({ value: count() })
      .from(testimonials)
      .where(eq(testimonials.spaceId, apiKey.spaceId));

    return NextResponse.json({
      spaces: [
        {
          ...space,
          testimonialCount: testimonialCount?.value ?? 0,
        },
      ],
    });
  } catch (error) {
    log.error("v1 GET /spaces error:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch space");
  }
});
