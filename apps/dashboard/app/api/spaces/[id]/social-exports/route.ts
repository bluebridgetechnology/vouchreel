import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { socialExports, spaces, testimonials } from "@/lib/db/schema";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id: spaceId } = await params;

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
      .select({
        id: socialExports.id,
        spaceId: socialExports.spaceId,
        testimonialId: socialExports.testimonialId,
        format: socialExports.format,
        outputUrl: socialExports.outputUrl,
        status: socialExports.status,
        errorMessage: socialExports.errorMessage,
        metadata: socialExports.metadata,
        createdAt: socialExports.createdAt,
        completedAt: socialExports.completedAt,
        testimonialTitle: testimonials.title,
        customerName: testimonials.customerName,
        customerCompany: testimonials.customerCompany,
        thumbnailUrl: testimonials.thumbnailUrl,
      })
      .from(socialExports)
      .leftJoin(testimonials, eq(testimonials.id, socialExports.testimonialId))
      .where(eq(socialExports.spaceId, spaceId))
      .orderBy(desc(socialExports.createdAt));

    return NextResponse.json({ exports: exportsList });
  } catch (error) {
    log.error("Failed to fetch space social exports:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch space social exports");
  }
}
