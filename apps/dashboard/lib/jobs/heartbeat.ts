import os from "node:os";
import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { workerHeartbeats } from "@/lib/db/schema";
import { log } from "@/lib/log";

/**
 * Worker liveness. Each worker process upserts one row in worker_heartbeats every few seconds;
 * the admin area reads it. Telemetry only: a failed write is logged and never stops the worker.
 */

export const HEARTBEAT_INTERVAL_MS = 15_000;
/** Three missed beats. A worker older than this is shown as not responding. */
export const ONLINE_WITHIN_MS = 3 * HEARTBEAT_INTERVAL_MS;
/** Rows for processes that have been gone this long are deleted when a new worker starts. */
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface HeartbeatOptions {
  workerId: string;
  kind: "worker" | "video-worker";
  concurrency: number;
  /** What the process found on start-up, shown in the admin System tab. */
  capabilities?: Record<string, string>;
  intervalMs?: number;
  /** Called once when a platform admin asks this process to restart: finish in-flight jobs, then exit (the supervisor starts it again). */
  onRestartRequested?: () => void;
}

export interface Heartbeat {
  /** Adds to the count of jobs this process has claimed. */
  recordProcessed(count: number): void;
  /** Stops beating and marks the process as cleanly stopped. */
  stop(): Promise<void>;
}

export function startHeartbeat(options: HeartbeatOptions): Heartbeat {
  const startedAt = new Date();
  let processed = 0;
  let failing = false;
  let restartAsked = false;
  let stopping = false;
  // One beat at a time, in order. Two writes in flight can land in either order, and a slow
  // ordinary beat finishing after the final one would show a stopped worker as running.
  let queue: Promise<void> = Promise.resolve();
  const schedule = (stopped: boolean) => {
    queue = queue.then(() => (stopping && !stopped ? undefined : beat(stopped)));
    return queue;
  };

  async function beat(stopped = false) {
    try {
      const values = {
        workerId: options.workerId,
        kind: options.kind,
        hostname: os.hostname(),
        pid: process.pid,
        concurrency: options.concurrency,
        jobsProcessed: processed,
        capabilities: options.capabilities ?? {},
        startedAt,
        lastSeenAt: new Date(),
        stoppedAt: stopped ? new Date() : null,
      };
      const { workerId: _id, ...update } = values;
      await db.insert(workerHeartbeats).values(values).onConflictDoUpdate({ target: workerHeartbeats.workerId, set: update });
      if (failing) log.info(`[heartbeat] ${options.workerId} recovered`);
      failing = false;
      if (!stopped && !restartAsked && options.onRestartRequested) {
        const [row] = await db.select({ at: workerHeartbeats.restartRequestedAt }).from(workerHeartbeats).where(eq(workerHeartbeats.workerId, options.workerId));
        // A request older than this process is for an earlier run of the same id
        if (row?.at && row.at.getTime() > startedAt.getTime()) {
          restartAsked = true;
          log.info(`[heartbeat] ${options.workerId} was asked to restart`);
          options.onRestartRequested();
        }
      }
    } catch (error) {
      // Log the first failure only, so a database outage does not flood the log every 15 seconds
      if (!failing) log.warn(`[heartbeat] ${options.workerId} could not record a heartbeat:`, error instanceof Error ? error.message : error);
      failing = true;
    }
  }

  void schedule(false);
  void db
    .delete(workerHeartbeats)
    .where(lt(workerHeartbeats.lastSeenAt, new Date(Date.now() - PRUNE_AFTER_MS)))
    .catch(() => {});
  const timer = setInterval(() => void schedule(false), options.intervalMs ?? HEARTBEAT_INTERVAL_MS);
  timer.unref();

  return {
    recordProcessed(count) {
      processed += count;
    },
    async stop() {
      clearInterval(timer);
      stopping = true;
      await schedule(true);
    },
  };
}
