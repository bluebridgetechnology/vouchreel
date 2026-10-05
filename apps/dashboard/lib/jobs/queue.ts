import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";

export type Job = typeof jobs.$inferSelect;

export interface EnqueueOptions {
  /** Earliest time the job may run. Defaults to now. */
  runAt?: Date;
  maxAttempts?: number;
}

/** A running job whose lock is older than this is presumed dead (worker crashed or restarted). */
export const STALE_LOCK_MS = 15 * 60 * 1000;

/** Delay before retry after attempt number `attempts` (1-based): 30s, 2m, 8m, capped at 30m. */
export function backoffMs(attempts: number): number {
  return Math.min(30_000 * 4 ** Math.max(0, attempts - 1), 30 * 60 * 1000);
}

/** Anything with insert(): the shared db or a transaction, so a job can commit atomically with its trigger. */
export type JobExecutor = Pick<typeof db, "insert">;

export async function enqueueJob(
  type: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
  executor: JobExecutor = db
): Promise<Job> {
  const [job] = await executor
    .insert(jobs)
    .values({
      type,
      payload,
      runAt: options.runAt ?? new Date(),
      ...(options.maxAttempts ? { maxAttempts: options.maxAttempts } : {}),
    })
    .returning();
  return job;
}

/**
 * Atomically claims the oldest runnable job. Concurrent workers never receive the same row
 * because of FOR UPDATE SKIP LOCKED. Increments `attempts` on claim.
 */
export interface ClaimFilter {
  /** Claim only these job types (e.g. the video worker, which has Chromium). */
  only?: string[];
  /** Never claim these types (e.g. the regular worker, which cannot render video). */
  except?: string[];
}

export async function claimJob(workerId: string, filter: ClaimFilter = {}): Promise<Job | null> {
  const list = (types: string[]) => sql.join(types.map((t) => sql`${t}`), sql`, `);
  const only = filter.only?.length ? sql`AND type IN (${list(filter.only)})` : sql``;
  const except = filter.except?.length ? sql`AND type NOT IN (${list(filter.except)})` : sql``;
  const result = await db.execute(sql`
    UPDATE jobs SET
      status = 'running',
      locked_at = now(),
      locked_by = ${workerId},
      attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'queued' AND run_at <= now() ${only} ${except}
      ORDER BY run_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload, status, attempts, max_attempts AS "maxAttempts",
      run_at AS "runAt", locked_at AS "lockedAt", locked_by AS "lockedBy",
      last_error AS "lastError", created_at AS "createdAt", completed_at AS "completedAt"
  `);
  return (result.rows[0] as Job | undefined) ?? null;
}

export async function completeJob(id: string): Promise<void> {
  await db.execute(sql`
    UPDATE jobs SET status = 'done', completed_at = now(), locked_at = NULL, locked_by = NULL, last_error = NULL
    WHERE id = ${id}
  `);
}

/** Requeues with backoff while attempts remain; otherwise marks the job failed. */
export async function failJob(
  job: Pick<Job, "id" | "attempts" | "maxAttempts">,
  error: unknown
): Promise<"retry" | "failed"> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
  if (job.attempts < job.maxAttempts) {
    const runAt = new Date(Date.now() + backoffMs(job.attempts));
    await db.execute(sql`
      UPDATE jobs SET status = 'queued', run_at = ${runAt.toISOString()}, locked_at = NULL, locked_by = NULL, last_error = ${message}
      WHERE id = ${job.id}
    `);
    return "retry";
  }
  await db.execute(sql`
    UPDATE jobs SET status = 'failed', completed_at = now(), locked_at = NULL, locked_by = NULL, last_error = ${message}
    WHERE id = ${job.id}
  `);
  return "failed";
}

/**
 * Returns jobs stuck in `running` (lock older than `staleMs`) to the queue, or fails them if
 * they are out of attempts. Returns the number of jobs touched.
 */
export async function reclaimStaleJobs(staleMs = STALE_LOCK_MS): Promise<number> {
  const cutoff = new Date(Date.now() - staleMs).toISOString();
  const result = await db.execute(sql`
    UPDATE jobs SET
      status = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,
      completed_at = CASE WHEN attempts < max_attempts THEN NULL ELSE now() END,
      last_error = 'Worker lost (stale lock)',
      locked_at = NULL,
      locked_by = NULL
    WHERE status = 'running' AND locked_at < ${cutoff}
    RETURNING id
  `);
  return result.rows.length;
}
