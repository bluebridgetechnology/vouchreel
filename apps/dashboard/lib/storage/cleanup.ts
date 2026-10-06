import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionForms, generatedVideos, reviewVideos, socialExports, submissions, testimonials } from "@/lib/db/schema";
import { enqueueJob, type JobExecutor } from "@/lib/jobs/queue";
import { getStorage } from "@/lib/storage";
import { keyFromUrl } from "./keys";

/**
 * Deleting stored files when the rows that own them are deleted.
 *
 * Rows go in the same transaction that queues a `file_cleanup` job holding the files' keys, so the
 * files are never forgotten: a worker (or the cron drain) deletes them later, retrying on failure.
 * Before it deletes a key the job checks that no row still points at it, because one file can be
 * shared (a testimonial made from a submission uses the submission's video).
 */

export const FILE_CLEANUP_JOB = "file_cleanup";
/** Keys per job, so a payload stays small. */
export const FILE_CLEANUP_BATCH = 100;

type Executor = JobExecutor & Pick<typeof db, "select">;

/** Keys of the recognised files among `urls`, without duplicates. Unknown URLs are skipped (and logged). */
export function keysFromUrls(urls: (string | null | undefined)[]): string[] {
  const keys = new Set<string>();
  for (const url of urls) {
    if (!url) continue;
    const key = keyFromUrl(url);
    if (key) keys.add(key);
    else console.warn(`[storage] ${url} is not a file this app stored; it will not be cleaned up`);
  }
  return [...keys];
}

/** Queues deletion of the files behind `urls`. Pass the transaction that deletes the rows. Returns how many files were queued. */
export async function queueFileCleanup(urls: (string | null | undefined)[], executor: JobExecutor = db): Promise<number> {
  const keys = keysFromUrls(urls);
  for (let i = 0; i < keys.length; i += FILE_CLEANUP_BATCH) {
    await enqueueJob(FILE_CLEANUP_JOB, { keys: keys.slice(i, i + FILE_CLEANUP_BATCH) }, {}, executor);
  }
  return keys.length;
}

/** True when any row still has a URL containing this storage key. */
export async function isKeyReferenced(key: string, executor: Pick<typeof db, "execute"> = db): Promise<boolean> {
  const result = await executor.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM submissions WHERE strpos(coalesce(video_url, ''), ${key}) > 0 OR strpos(coalesce(thumbnail_url, ''), ${key}) > 0
      UNION ALL
      SELECT 1 FROM testimonials
        WHERE strpos(coalesce(video_url, ''), ${key}) > 0 OR strpos(coalesce(thumbnail_url, ''), ${key}) > 0 OR strpos(coalesce(clip_url, ''), ${key}) > 0
      UNION ALL
      SELECT 1 FROM social_exports WHERE strpos(coalesce(output_url, ''), ${key}) > 0
      UNION ALL
      SELECT 1 FROM generated_videos WHERE strpos(coalesce(output_url, ''), ${key}) > 0
      UNION ALL
      SELECT 1 FROM review_videos WHERE strpos(coalesce(output_url, ''), ${key}) > 0
    ) AS referenced`);
  return (result.rows[0] as { referenced: boolean }).referenced === true;
}

/**
 * The `file_cleanup` job. Deletes each key unless a row still uses it. Deleting a missing file is
 * not an error. If any delete fails the job throws after trying the rest, so the queue retries it.
 */
export async function runFileCleanup(keys: string[]): Promise<{ deleted: number; skipped: number }> {
  const storage = getStorage();
  let deleted = 0;
  let skipped = 0;
  const failures: string[] = [];
  for (const key of keys) {
    try {
      if (await isKeyReferenced(key)) {
        skipped++;
        continue;
      }
      await storage.delete(key);
      deleted++;
    } catch (error) {
      failures.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length) throw new Error(`Could not delete ${failures.length} file(s): ${failures.slice(0, 3).join("; ")}`);
  return { deleted, skipped };
}

// ─── What a row owns ─────────────────────────────────────────────────────────

const urlsOf = (rows: Record<string, string | null>[]) => rows.flatMap((r) => Object.values(r));

export async function collectTestimonialUrls(executor: Pick<typeof db, "select">, testimonialIds: string[]): Promise<(string | null)[]> {
  if (testimonialIds.length === 0) return [];
  // One after another: these run on a transaction's single connection
  const t = await executor
    .select({ a: testimonials.videoUrl, b: testimonials.thumbnailUrl, c: testimonials.clipUrl })
    .from(testimonials)
    .where(inArray(testimonials.id, testimonialIds));
  const exports = await executor.select({ a: socialExports.outputUrl }).from(socialExports).where(inArray(socialExports.testimonialId, testimonialIds));
  const ai = await executor.select({ a: generatedVideos.outputUrl }).from(generatedVideos).where(inArray(generatedVideos.testimonialId, testimonialIds));
  return [...urlsOf(t), ...urlsOf(exports), ...urlsOf(ai)];
}

export async function collectFormUrls(executor: Pick<typeof db, "select">, formIds: string[]): Promise<(string | null)[]> {
  if (formIds.length === 0) return [];
  const rows = await executor
    .select({ a: submissions.videoUrl, b: submissions.thumbnailUrl })
    .from(submissions)
    .where(inArray(submissions.formId, formIds));
  return urlsOf(rows);
}

/** Every file a space owns: its testimonials' (and their exports and AI videos), its review videos, and its forms' submissions. */
export async function collectSpaceUrls(executor: Pick<typeof db, "select">, spaceId: string): Promise<(string | null)[]> {
  const testimonialRows = await executor.select({ id: testimonials.id }).from(testimonials).where(eq(testimonials.spaceId, spaceId));
  const formRows = await executor.select({ id: collectionForms.id }).from(collectionForms).where(eq(collectionForms.spaceId, spaceId));
  const review = await executor.select({ a: reviewVideos.outputUrl }).from(reviewVideos).where(eq(reviewVideos.spaceId, spaceId));
  const fromTestimonials = await collectTestimonialUrls(executor, testimonialRows.map((r) => r.id));
  const fromForms = await collectFormUrls(executor, formRows.map((r) => r.id));
  // Exports and AI videos hang off the space as well as the testimonial; cover any not reached above
  const exports = await executor.select({ a: socialExports.outputUrl }).from(socialExports).where(eq(socialExports.spaceId, spaceId));
  const ai = await executor.select({ a: generatedVideos.outputUrl }).from(generatedVideos).where(eq(generatedVideos.spaceId, spaceId));
  return [...fromTestimonials, ...fromForms, ...urlsOf(review), ...urlsOf(exports), ...urlsOf(ai)];
}
