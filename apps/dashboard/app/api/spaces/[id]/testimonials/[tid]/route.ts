import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, testimonials } from "@/lib/db/schema";
import { updateTestimonialSchema } from "@/lib/validations/testimonials";

interface RouteParams {
  params: Promise<{ id: string; tid: string }>;
}

/**
 * Helper to verify user ownership and testimonial existence
 */
async function verifySpaceAndTestimonial(
  spaceId: string,
  testimonialId: string,
  userId: string
) {
  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, spaceId));

  if (!space) {
    return { error: "Space not found", status: 404 };
  }

  if (space.ownerId !== userId) {
    return { error: "Forbidden: You do not own this space", status: 403 };
  }

  const [testimonial] = await db
    .select()
    .from(testimonials)
    .where(
      and(
        eq(testimonials.id, testimonialId),
        eq(testimonials.spaceId, spaceId)
      )
    );

  if (!testimonial) {
    return { error: "Testimonial not found", status: 404 };
  }

  return { space, testimonial };
}

/**
 * GET /api/spaces/[id]/testimonials/[tid]
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, tid } = await params;
  const result = await verifySpaceAndTestimonial(id, tid, session.user.id);
  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({ testimonial: result.testimonial });
}

/**
 * PUT /api/spaces/[id]/testimonials/[tid]
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, tid } = await params;
  const result = await verifySpaceAndTestimonial(id, tid, session.user.id);
  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  try {
    const body = await request.json();
    const validated = updateTestimonialSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validated.data;
    const updatePayload: Record<string, unknown> = {};

    if (data.videoUrl !== undefined) updatePayload.videoUrl = data.videoUrl;
    if (data.platform !== undefined) updatePayload.platform = data.platform;
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.thumbnailUrl !== undefined) updatePayload.thumbnailUrl = data.thumbnailUrl;
    if (data.durationSeconds !== undefined) updatePayload.durationSeconds = data.durationSeconds;
    if (data.quote !== undefined) updatePayload.quote = data.quote;
    if (data.customerName !== undefined) updatePayload.customerName = data.customerName;
    if (data.customerCompany !== undefined) updatePayload.customerCompany = data.customerCompany;
    if (data.tags !== undefined) updatePayload.tags = data.tags;
    if (data.matchRules !== undefined) updatePayload.matchRules = data.matchRules;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
    if (data.sortOrder !== undefined) updatePayload.sortOrder = data.sortOrder;

    const [updated] = await db
      .update(testimonials)
      .set(updatePayload)
      .where(
        and(
          eq(testimonials.id, tid),
          eq(testimonials.spaceId, id)
        )
      )
      .returning();

    return NextResponse.json({ testimonial: updated });
  } catch (error) {
    console.error("Failed to update testimonial:", error);
    return NextResponse.json(
      { error: "Failed to update testimonial" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/spaces/[id]/testimonials/[tid]
 * Soft-delete testimonial (sets isActive = false)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, tid } = await params;
  const result = await verifySpaceAndTestimonial(id, tid, session.user.id);
  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  try {
    // Soft delete per spec: set isActive = false
    await db
      .update(testimonials)
      .set({ isActive: false })
      .where(
        and(
          eq(testimonials.id, tid),
          eq(testimonials.spaceId, id)
        )
      );

    return NextResponse.json({ success: true, id: tid });
  } catch (error) {
    console.error("Failed to soft-delete testimonial:", error);
    return NextResponse.json(
      { error: "Failed to delete testimonial" },
      { status: 500 }
    );
  }
}
