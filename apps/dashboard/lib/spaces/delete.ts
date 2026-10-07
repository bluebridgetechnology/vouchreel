import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionForms, spaces, testimonials } from "@/lib/db/schema";
import { collectFormUrls, collectSpaceUrls, collectTestimonialUrls, queueFileCleanup } from "@/lib/storage/cleanup";

/**
 * Permanent deletes that also clean up the files the rows owned. The rows are deleted and a
 * `file_cleanup` job is queued in one transaction, so a file is never left behind unnoticed.
 */

/** Deletes a space and everything in it. Returns how many stored files were queued for deletion. */
export async function deleteSpace(spaceId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const files = await queueFileCleanup(await collectSpaceUrls(tx, spaceId), tx);
    await tx.delete(spaces).where(eq(spaces.id, spaceId));
    return files;
  });
}

/** Deletes a collection form and its submissions. Returns null when there is no such form in the space. */
export async function deleteCollectionForm(spaceId: string, formId: string): Promise<{ files: number } | null> {
  return db.transaction(async (tx) => {
    const [form] = await tx
      .select({ id: collectionForms.id })
      .from(collectionForms)
      .where(and(eq(collectionForms.id, formId), eq(collectionForms.spaceId, spaceId)));
    if (!form) return null;
    const files = await queueFileCleanup(await collectFormUrls(tx, [formId]), tx);
    await tx.delete(collectionForms).where(eq(collectionForms.id, formId));
    return { files };
  });
}

/** Permanently deletes a testimonial (the public API's delete). Returns the deleted row, or null when it does not exist in the space. */
export async function deleteTestimonialPermanently(spaceId: string, testimonialId: string) {
  return db.transaction(async (tx) => {
    const urls = await collectTestimonialUrls(tx, [testimonialId]);
    const [deleted] = await tx
      .delete(testimonials)
      .where(and(eq(testimonials.id, testimonialId), eq(testimonials.spaceId, spaceId)))
      .returning();
    if (!deleted) return null;
    await queueFileCleanup(urls, tx);
    return deleted;
  });
}
