import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [space] = await db
      .select()
      .from(spaces)
      .where(eq(spaces.id, id));

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (space.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this space" },
        { status: 403 }
      );
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
    return NextResponse.json(
      { error: "Failed to fetch space" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/spaces/[id]
 * Update space name. Ensures user is the owner.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [space] = await db
      .select()
      .from(spaces)
      .where(eq(spaces.id, id));

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (space.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this space" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = updateSpaceSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
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
    return NextResponse.json(
      { error: "Failed to update space" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/spaces/[id]
 * Delete a space. Ensures user is the owner.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [space] = await db
      .select()
      .from(spaces)
      .where(eq(spaces.id, id));

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (space.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this space" },
        { status: 403 }
      );
    }

    await db.delete(spaces).where(eq(spaces.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete space:", error);
    return NextResponse.json(
      { error: "Failed to delete space" },
      { status: 500 }
    );
  }
}
