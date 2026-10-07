import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { apiError, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deleteSpace } from "@/lib/spaces/delete";
import { spaces, testimonials } from "@/lib/db/schema";
import { updateSpaceSchema } from "@/lib/validations/spaces";
import { verifySpaceAccess } from "@/lib/auth/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/spaces/[id]
 * Fetch a single space by ID. Allows owner, editor, or viewer.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id } = await params;

  try {
    const authCheck = await verifySpaceAccess(session.user.id, id, "viewer");
    if (!authCheck.success) {
      return authCheck.errorResponse;
    }

    const { space, role, isDirectOwner } = authCheck.access;

    const [testimonialCount] = await db
      .select({ value: count() })
      .from(testimonials)
      .where(eq(testimonials.spaceId, space.id));

    return NextResponse.json({
      space: {
        ...space,
        testimonialCount: testimonialCount?.value ?? 0,
        role,
        isDirectOwner,
      },
    });
  } catch (error) {
    console.error("Failed to fetch space:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch space");
  }
}

/**
 * PUT /api/spaces/[id]
 * Update space name. Allows owner or editor.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id } = await params;

  try {
    const authCheck = await verifySpaceAccess(session.user.id, id, "editor");
    if (!authCheck.success) {
      return authCheck.errorResponse;
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

    return NextResponse.json({
      space: {
        ...updatedSpace,
        role: authCheck.access.role,
        isDirectOwner: authCheck.access.isDirectOwner,
      },
    });
  } catch (error) {
    console.error("Failed to update space:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to update space");
  }
}

/**
 * DELETE /api/spaces/[id]
 * Delete a space. Strictly requires owner role (editors and viewers cannot delete spaces).
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { id } = await params;

  try {
    const authCheck = await verifySpaceAccess(session.user.id, id, "owner");
    if (!authCheck.success) {
      return authCheck.errorResponse;
    }

    await deleteSpace(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete space:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to delete space");
  }
}
