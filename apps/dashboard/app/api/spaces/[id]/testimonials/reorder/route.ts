import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
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
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;

  // Verify space ownership
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
    const body = await request.json();
    const validated = reorderTestimonialsSchema.safeParse(body);

    if (!validated.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: validated.error.flatten().fieldErrors,
      });
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
    return apiError(500, "INTERNAL_ERROR", "Failed to reorder testimonials");
  }
}

export async function POST(request: Request, context: RouteParams) {
  return PUT(request, context);
}
