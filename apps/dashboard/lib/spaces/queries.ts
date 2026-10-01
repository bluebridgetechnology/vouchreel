import { count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces, testimonials } from "@/lib/db/schema";

export interface SpaceListItem {
  id: string;
  name: string;
  ownerId: string;
  embedKey: string;
  createdAt: string;
  testimonialCount: number;
}

export async function getSpacesWithCounts(
  userId: string
): Promise<SpaceListItem[]> {
  const userSpaces = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      ownerId: spaces.ownerId,
      embedKey: spaces.embedKey,
      createdAt: spaces.createdAt,
    })
    .from(spaces)
    .where(eq(spaces.ownerId, userId))
    .orderBy(desc(spaces.createdAt));

  return Promise.all(
    userSpaces.map(async (space) => {
      const [testimonialCount] = await db
        .select({ value: count() })
        .from(testimonials)
        .where(eq(testimonials.spaceId, space.id));

      return {
        ...space,
        createdAt: space.createdAt.toISOString(),
        testimonialCount: testimonialCount?.value ?? 0,
      };
    })
  );
}
