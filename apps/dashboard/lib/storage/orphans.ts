import { db } from "@/lib/db";
import { generatedVideos, reviewVideos, socialExports, submissions, testimonials } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import type { StorageAdapter, StoredFile } from "./types";
import { FILE_PREFIXES, keyFromUrl } from "./keys";

/**
 * Finding files in storage that no row points at any more (left by deletes made before files were
 * cleaned up, or by an upload that never got a row). Files newer than the grace period are never
 * touched, because an upload may be in flight and not have its row yet.
 */

export const DEFAULT_GRACE_MS = 24 * 60 * 60 * 1000;

/** Keys every row in the database still points at. */
export async function referencedKeys(): Promise<Set<string>> {
  const [sub, tes, exp, ai, rev] = await Promise.all([
    db.select({ a: submissions.videoUrl, b: submissions.thumbnailUrl }).from(submissions),
    db.select({ a: testimonials.videoUrl, b: testimonials.thumbnailUrl, c: testimonials.clipUrl }).from(testimonials),
    db.select({ a: socialExports.outputUrl }).from(socialExports),
    db.select({ a: generatedVideos.outputUrl }).from(generatedVideos),
    db.select({ a: reviewVideos.outputUrl }).from(reviewVideos),
  ]);
  const keys = new Set<string>();
  for (const row of [...sub, ...tes, ...exp, ...ai, ...rev]) {
    for (const url of Object.values(row)) {
      const key = keyFromUrl(url);
      if (key) keys.add(key);
    }
  }
  return keys;
}

export interface OrphanReport {
  /** Files listed under the app's prefixes. */
  scanned: number;
  /** Files a row still points at. */
  referenced: number;
  /** Files too new to judge. */
  tooNew: number;
  orphans: StoredFile[];
}

export async function findOrphanedFiles(
  options: { graceMs?: number; storage?: StorageAdapter; now?: Date } = {}
): Promise<OrphanReport> {
  const storage = options.storage ?? getStorage();
  const cutoff = (options.now ?? new Date()).getTime() - (options.graceMs ?? DEFAULT_GRACE_MS);
  const referenced = await referencedKeys();
  const report: OrphanReport = { scanned: 0, referenced: 0, tooNew: 0, orphans: [] };
  for (const prefix of FILE_PREFIXES) {
    for await (const file of storage.list(prefix)) {
      report.scanned++;
      if (referenced.has(file.key)) report.referenced++;
      else if (file.lastModified.getTime() > cutoff) report.tooNew++;
      else report.orphans.push(file);
    }
  }
  return report;
}

/** Deletes the orphans found by findOrphanedFiles. Keeps going after a failure and reports it. */
export async function deleteOrphanedFiles(
  orphans: StoredFile[],
  storage: StorageAdapter = getStorage()
): Promise<{ deleted: number; failed: { key: string; error: string }[] }> {
  let deleted = 0;
  const failed: { key: string; error: string }[] = [];
  for (const file of orphans) {
    try {
      await storage.delete(file.key);
      deleted++;
    } catch (error) {
      failed.push({ key: file.key, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { deleted, failed };
}
