import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { socialExports, spaces } from "@/lib/db/schema";
import { queueFileCleanup } from "@/lib/storage/cleanup";

interface RouteParams {
  params: Promise<{ id: string; exportId: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id: spaceId, exportId } = await params;

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
    const [exportRecord] = await db
      .select()
      .from(socialExports)
      .where(
        and(
          eq(socialExports.id, exportId),
          eq(socialExports.spaceId, spaceId)
        )
      );

    if (!exportRecord) {
      return apiError(404, "NOT_FOUND", "Export record not found");
    }

    return NextResponse.json({ export: exportRecord });
  } catch (error) {
    console.error("Failed to fetch export status:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch export status");
  }
}

/**
 * Deletes an export and its video file. Finished and failed exports can be deleted; one that is still
 * being made cannot, because its render would upload a file after the row was gone. The file is
 * removed by a queued cleanup job in the same transaction that deletes the row.
 */
export async function DELETE(_: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id: spaceId, exportId } = await params;
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
  if (!space) return apiError(404, "NOT_FOUND", "Space not found");
  if (space.ownerId !== session.user.id) return apiError(403, "FORBIDDEN", "Forbidden: You do not own this space");

  try {
    const result = await db.transaction(async (tx) => {
      const [record] = await tx
        .select({ status: socialExports.status, outputUrl: socialExports.outputUrl })
        .from(socialExports)
        .where(and(eq(socialExports.id, exportId), eq(socialExports.spaceId, spaceId)));
      if (!record) return "missing" as const;
      if (record.status === "pending" || record.status === "processing") return "busy" as const;
      await queueFileCleanup([record.outputUrl], tx);
      await tx.delete(socialExports).where(eq(socialExports.id, exportId));
      return "deleted" as const;
    });
    if (result === "missing") return apiError(404, "NOT_FOUND", "Export record not found");
    if (result === "busy") return apiError(400, "BAD_REQUEST", "This export is still being made. Wait for it to finish.");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete export:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to delete the export");
  }
}
