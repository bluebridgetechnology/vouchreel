import type { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { AiVideoError } from "./errors";
import { log } from "@/lib/log";

/** Resolves the signed-in space owner, or returns the error response to send. */
export async function requireSpaceOwner(
  spaceId: string
): Promise<{ userId: string; ownerId: string } | { response: NextResponse }> {
  const session = await getSession();
  if (!session?.user?.id) return { response: apiError(401, "UNAUTHORIZED", "Unauthorized") };
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
  if (!space) return { response: apiError(404, "NOT_FOUND", "Space not found") };
  if (space.ownerId !== session.user.id) {
    return { response: apiError(403, "FORBIDDEN", "Forbidden: You do not own this space") };
  }
  return { userId: session.user.id, ownerId: space.ownerId };
}

/** Maps an expected AiVideoError to an API response; anything else is a 500. */
export function aiVideoErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof AiVideoError) {
    return apiError(error.status, error.code, error.message, error.details !== undefined ? { details: error.details } : undefined);
  }
  log.error(fallback, error);
  return apiError(500, "INTERNAL_ERROR", fallback);
}
