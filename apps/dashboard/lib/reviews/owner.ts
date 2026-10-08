import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviewSources, spaces } from "@/lib/db/schema";

/** Whether this user may manage the space: yes, no such space, or someone else's. */
export async function spaceAccess(spaceId: string, userId: string): Promise<"ok" | "missing" | "forbidden"> {
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
  if (!space) return "missing";
  return space.ownerId === userId ? "ok" : "forbidden";
}

/** A review source of that space. */
export async function spaceSource(spaceId: string, sourceId: string) {
  const [source] = await db
    .select()
    .from(reviewSources)
    .where(and(eq(reviewSources.id, sourceId), eq(reviewSources.spaceId, spaceId)));
  return source ?? null;
}
