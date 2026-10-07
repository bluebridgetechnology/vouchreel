import { randomUUID } from "crypto";
import { claimJob, completeJob, failJob, reclaimStaleJobs, type ClaimFilter, type Job } from "./queue";
import { getJobFailureHandler, getJobHandler, registerBuiltInHandlers } from "./handlers";
import { startHeartbeat, type HeartbeatOptions } from "./heartbeat";

export interface RunOptions extends ClaimFilter {
  workerId?: string;
  /** Max jobs processed in parallel. */
  concurrency?: number;
  /** Report liveness to the admin area while running (long-running workers only). */
  heartbeat?: Pick<HeartbeatOptions, "kind" | "capabilities">;
}

/** Runs one claimed job to completion, recording success or failure. */
export async function processJob(job: Job): Promise<"done" | "retry" | "failed"> {
  const handler = getJobHandler(job.type);
  if (!handler) {
    // An unknown type will never succeed, so do not burn retries on it.
    await failJob({ ...job, attempts: job.maxAttempts }, new Error(`No handler for job type "${job.type}"`));
    return "failed";
  }
  try {
    await handler(job.payload);
    await completeJob(job.id);
    return "done";
  } catch (error) {
    console.error(`[worker] job ${job.id} (${job.type}) failed:`, error);
    const outcome = await failJob(job, error);
    if (outcome === "failed") {
      try {
        await getJobFailureHandler(job.type)?.(job.payload, error);
      } catch (settleError) {
        console.error(`[worker] failure handler for job ${job.id} threw:`, settleError);
      }
    }
    return outcome;
  }
}

/**
 * Claims and processes jobs until none are runnable, honouring `concurrency`.
 * Used by both the long-running worker loop and the cron drain endpoint.
 */
export async function drainQueue(options: RunOptions & { maxJobs?: number } = {}): Promise<number> {
  await registerBuiltInHandlers();
  const workerId = options.workerId ?? `drain-${randomUUID()}`;
  const concurrency = Math.max(1, options.concurrency ?? 1);
  const maxJobs = options.maxJobs ?? Infinity;
  let claimed = 0;
  let exhausted = false;

  async function lane() {
    while (!exhausted && claimed < maxJobs) {
      claimed++; // reserve a slot before awaiting so lanes cannot overshoot maxJobs
      const job = await claimJob(workerId, { only: options.only, except: options.except });
      if (!job) {
        claimed--;
        exhausted = true;
        return;
      }
      await processJob(job);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, lane));
  return claimed;
}

/** Long-running worker: polls until the signal aborts, finishing in-flight jobs first. */
export async function runWorker(signal: AbortSignal, options: RunOptions = {}): Promise<void> {
  const workerId = options.workerId ?? `worker-${randomUUID()}`;
  const concurrency = Math.max(1, options.concurrency ?? Number(process.env.WORKER_CONCURRENCY ?? 2));
  const pollMs = Number(process.env.WORKER_POLL_MS ?? 2000);
  let lastReclaim = 0;
  // An admin's restart request ends the loop the same way a shutdown signal does
  const restart = new AbortController();
  const stop = AbortSignal.any([signal, restart.signal]);
  const heartbeat = options.heartbeat ? startHeartbeat({ workerId, concurrency, ...options.heartbeat, onRestartRequested: () => restart.abort() }) : null;

  console.log(`[worker] ${workerId} started (concurrency ${concurrency})`);
  while (!stop.aborted) {
    if (Date.now() - lastReclaim > 60_000) {
      lastReclaim = Date.now();
      try {
        const n = await reclaimStaleJobs();
        if (n) console.warn(`[worker] reclaimed ${n} stale job(s)`);
      } catch (error) {
        console.error("[worker] reclaim failed:", error);
      }
    }
    let processed = 0;
    try {
      processed = await drainQueue({ workerId, concurrency, only: options.only, except: options.except });
      heartbeat?.recordProcessed(processed);
    } catch (error) {
      console.error("[worker] poll failed:", error);
    }
    if (processed === 0) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, pollMs);
        stop.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            resolve();
          },
          { once: true }
        );
      });
    }
  }
  await heartbeat?.stop();
  console.log(`[worker] ${workerId} stopped`);
}
