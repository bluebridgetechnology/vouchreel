import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, testimonials } from "@/lib/db/schema";
import { bulkMatchRulesSchema } from "@/lib/validations/testimonials";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PUT /api/spaces/[id]/testimonials/match-rules: apply one set of page rules to many testimonials. */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;

  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, id));

  if (!space) {
    return apiError(404, "NOT_FOUND", "Space not found");
  }
  if (space.ownerId !== session.user.id) {
    return apiError(403, "FORBIDDEN", "Forbidden: You do not own this space");
  }

  try {
    const validated = bulkMatchRulesSchema.safeParse(await request.json());
    if (!validated.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: validated.error.flatten().fieldErrors,
      });
    }

    // Scoped to this space, so ids from another space are ignored rather than touched
    const updated = await db
      .update(testimonials)
      .set({ matchRules: validated.data.matchRules })
      .where(and(eq(testimonials.spaceId, id), inArray(testimonials.id, validated.data.ids)))
      .returning({ id: testimonials.id });

    return NextResponse.json({ success: true, updated: updated.map((r) => r.id) });
  } catch (error) {
    log.error("Failed to set testimonial page rules:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to set page rules");
  }
}
