import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { socialExports, spaces, testimonials } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ id: string; tid: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id: spaceId, tid: testimonialId } = await params;

  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, spaceId));

  if (!space) {
    return apiError(404, "NOT_FOUND", "Space not found");
  }

  if (space.ownerId !== session.user.id) {
    return apiError(403, "FORBIDDEN", "Forbidden: You do not own this space");
  }

  try {
    const exportsList = await db
      .select()
      .from(socialExports)
      .where(
        and(
          eq(socialExports.spaceId, spaceId),
          eq(socialExports.testimonialId, testimonialId)
        )
      )
      .orderBy(desc(socialExports.createdAt));

    return NextResponse.json({ exports: exportsList });
  } catch (error) {
    console.error("Failed to fetch testimonial exports:", error);
    return apiError(
      500,
      "INTERNAL_ERROR",
      "Failed to fetch exports for this testimonial"
    );
  }
}
