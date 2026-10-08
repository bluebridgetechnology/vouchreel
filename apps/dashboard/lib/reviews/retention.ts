import { and, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";

import { reviewTextRetentionDays } from "./retention-config";

export { DEFAULT_REVIEW_TEXT_RETENTION_DAYS, reviewTextRetentionDays } from "./retention-config";

/** Removes third-party review text older than the retention period. Returns how many reviews lost their text. */
export async function purgeStaleReviewText(now = new Date(), days = reviewTextRetentionDays()): Promise<number> {
  if (days === 0) return 0;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .update(reviews)
    .set({ text: null })
    .where(
      and(
        ne(reviews.provider, "own"),
        isNotNull(reviews.text),
        // Rows from before the column existed count from the day they were created
        sql`coalesce(${reviews.textFetchedAt}, ${reviews.createdAt}) < ${cutoff}`
      )
    )
    .returning({ id: reviews.id });
  return rows.length;
}
