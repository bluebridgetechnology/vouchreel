import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { apiError, notFound, forbidden } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, apiKeys } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ id: string; keyId: string }>;
}

/**
 * DELETE /api/spaces/[id]/api-keys/[keyId]
 * Revokes / deletes an API key.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id, keyId } = await params;

  // Verify space owner
  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, id));

  if (!space) {
    return notFound("Space not found");
  }

  if (space.ownerId !== session.user.id) {
    return forbidden("Forbidden: You do not own this space");
  }

  try {
    const [deleted] = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.spaceId, id)))
      .returning({ id: apiKeys.id });

    if (!deleted) {
      return notFound("API key not found");
    }

    return NextResponse.json({ success: true, id: deleted.id });
  } catch (error) {
    console.error("Failed to delete API key:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to delete API key");
  }
}
