import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, testimonials } from "@/lib/db/schema";
import { reorderTestimonialsSchema, ReorderItem } from "@/lib/validations/testimonials";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify space ownership
  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
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

  try {
    const body = await request.json();
    const validated = reorderTestimonialsSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const items: ReorderItem[] = Array.isArray(validated.data)
      ? validated.data
      : validated.data.items;

    // Bulk update sort orders
    await Promise.all(
      items.map((item) =>
        db
          .update(testimonials)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(testimonials.id, item.id),
              eq(testimonials.spaceId, id)
            )
          )
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder testimonials:", error);
    return NextResponse.json(
      { error: "Failed to reorder testimonials" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteParams) {
  return PUT(request, context);
}
