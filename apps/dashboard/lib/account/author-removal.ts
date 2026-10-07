import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionForms, spaces, submissions, testimonialConsents, testimonials } from "@/lib/db/schema";
import { collectTestimonialUrls, queueFileCleanup } from "@/lib/storage/cleanup";

/**
 * "Remove everything for this email": the people who wrote testimonials are not account holders, so when
 * one of them asks to be forgotten the owner needs a single action. An email is stored only on form
 * submissions, so that is where matching starts; testimonials that came from those submissions (through
 * their consent record) go with them, along with every video made from them. A testimonial typed in by hand
 * carries no email and cannot be found this way.
 */

const normalize = (email: string) => email.trim().toLowerCase();

export interface RemovalPreview {
  submissions: number;
  testimonials: number;
}

async function ownedForms(ownerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: collectionForms.id })
    .from(collectionForms)
    .innerJoin(spaces, eq(spaces.id, collectionForms.spaceId))
    .where(eq(spaces.ownerId, ownerId));
  return rows.map((r) => r.id);
}

async function matches(ownerId: string, email: string) {
  const formIds = await ownedForms(ownerId);
  if (formIds.length === 0) return { submissionIds: [] as string[], testimonialIds: [] as string[], formIds };
  const subs = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(and(inArray(submissions.formId, formIds), sql`lower(${submissions.customerEmail}) = ${normalize(email)}`));
  const submissionIds = subs.map((s) => s.id);
  if (submissionIds.length === 0) return { submissionIds, testimonialIds: [] as string[], formIds };
  const linked = await db
    .select({ id: testimonialConsents.testimonialId })
    .from(testimonialConsents)
    .where(inArray(testimonialConsents.submissionId, submissionIds));
  return { submissionIds, testimonialIds: [...new Set(linked.map((l) => l.id))], formIds };
}

export async function previewRemoval(ownerId: string, email: string): Promise<RemovalPreview> {
  const m = await matches(ownerId, email);
  return { submissions: m.submissionIds.length, testimonials: m.testimonialIds.length };
}

/** Deletes what matches, and queues the files, in one transaction. */
export async function removeByEmail(ownerId: string, email: string): Promise<RemovalPreview & { files: number }> {
  const m = await matches(ownerId, email);
  if (m.submissionIds.length === 0) return { submissions: 0, testimonials: 0, files: 0 };
  return db.transaction(async (tx) => {
    const fileRows = await tx
      .select({ a: submissions.videoUrl, b: submissions.thumbnailUrl })
      .from(submissions)
      .where(inArray(submissions.id, m.submissionIds));
    const urls = [
      ...fileRows.flatMap((r) => [r.a, r.b]),
      ...(await collectTestimonialUrls(tx, m.testimonialIds)),
    ];
    const files = await queueFileCleanup(urls, tx);
    if (m.testimonialIds.length) await tx.delete(testimonials).where(inArray(testimonials.id, m.testimonialIds));
    await tx.delete(submissions).where(inArray(submissions.id, m.submissionIds));
    return { submissions: m.submissionIds.length, testimonials: m.testimonialIds.length, files };
  });
}
