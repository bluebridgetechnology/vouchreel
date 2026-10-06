import os from "node:os";
import { lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { workerHeartbeats } from "@/lib/db/schema";

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
      if (failing) console.log(`[heartbeat] ${options.workerId} recovered`);
      failing = false;
    } catch (error) {
      // Log the first failure only, so a database outage does not flood the log every 15 seconds
      if (!failing) console.warn(`[heartbeat] ${options.workerId} could not record a heartbeat:`, error instanceof Error ? error.message : error);
      failing = true;
    }
  }

  void beat();
  void db
    .delete(workerHeartbeats)
    .where(lt(workerHeartbeats.lastSeenAt, new Date(Date.now() - PRUNE_AFTER_MS)))
    .catch(() => {});
  const timer = setInterval(() => void beat(), options.intervalMs ?? HEARTBEAT_INTERVAL_MS);
  timer.unref();

  return {
    recordProcessed(count) {
      processed += count;
    },
    async stop() {
      clearInterval(timer);
      await beat(true);
    },
  };
}
