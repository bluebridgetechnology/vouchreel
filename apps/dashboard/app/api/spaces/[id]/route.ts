import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, testimonials } from "@/lib/db/schema";
import { updateSpaceSchema } from "@/lib/validations/spaces";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/spaces/[id]
 * Fetch a single space by ID. Ensures user is the owner.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;

  try {
    const [space] = await db
      .select()
      .from(spaces)
      .where(eq(spaces.id, id));

    if (!space) {
      return apiError(404, "NOT_FOUND", "Space not found");
    }

    if (space.ownerId !== session.user.id) {
      return apiError(403, "FORBIDDEN", "Forbidden: You do not own this space");
    }

    const [testimonialCount] = await db
      .select({ value: count() })
      .from(testimonials)
      .where(eq(testimonials.spaceId, space.id));

    return NextResponse.json({
      space: {
        ...space,
        testimonialCount: testimonialCount?.value ?? 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch space:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch space");
  }
}

/**
 * PUT /api/spaces/[id]
 * Update space name. Ensures user is the owner.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;

  try {
    const [space] = await db
      .select()
      .from(spaces)
      .where(eq(spaces.id, id));

    if (!space) {
      return apiError(404, "NOT_FOUND", "Space not found");
    }

    if (space.ownerId !== session.user.id) {
      return apiError(403, "FORBIDDEN", "Forbidden: You do not own this space");
    }

    const body = await request.json();
    const validated = updateSpaceSchema.safeParse(body);

    if (!validated.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: validated.error.flatten().fieldErrors,
      });
    }

    const [updatedSpace] = await db
      .update(spaces)
      .set({
        name: validated.data.name,
      })
      .where(eq(spaces.id, id))
      .returning();

    return NextResponse.json({ space: updatedSpace });
  } catch (error) {
    console.error("Failed to update space:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to update space");
  }
}

/**
 * DELETE /api/spaces/[id]
 * Delete a space. Ensures user is the owner.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;

  try {
    const [space] = await db
      .select()
      .from(spaces)
      .where(eq(spaces.id, id));

    if (!space) {
      return apiError(404, "NOT_FOUND", "Space not found");
    }

    if (space.ownerId !== session.user.id) {
      return apiError(403, "FORBIDDEN", "Forbidden: You do not own this space");
    }

    await db.delete(spaces).where(eq(spaces.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete space:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to delete space");
  }
}
