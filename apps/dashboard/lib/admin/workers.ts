import { gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { workerHeartbeats } from "@/lib/db/schema";
import { ONLINE_WITHIN_MS } from "@/lib/jobs/heartbeat";
import { JOB_TYPES } from "@/lib/jobs/handlers";

/**
 * Platform-admin view of the job workers: which processes are alive (from their heartbeat),
 * what they found at start-up, and whether work is waiting with nobody to do it.
 */

export type WorkerKind = "worker" | "video-worker";
export type WorkerStatus = "online" | "not_responding" | "stopped";
export type Severity = "ok" | "warning" | "critical";

/** A job waiting longer than this while workers are online is flagged as possibly stuck. */
export const SLOW_QUEUE_MS = 5 * 60 * 1000;
/** Workers last seen longer ago than this are not listed. */
const LISTED_FOR_MS = 24 * 60 * 60 * 1000;

export interface AdminWorker {
  workerId: string;
  kind: WorkerKind;
  hostname: string | null;
  pid: number | null;
  concurrency: number;
  jobsProcessed: number;
  capabilities: Record<string, string>;
  startedAt: Date;
  lastSeenAt: Date;
  stoppedAt: Date | null;
  status: WorkerStatus;
}

export interface KindHealth {
  kind: WorkerKind;
  label: string;
  /** Processes that are alive (recent heartbeat). */
  online: number;
  /** Jobs ready to run and not yet claimed that this kind of worker handles. */
  queued: number;
  oldestQueuedAt: Date | null;
  severity: Severity;
  /** One sentence for the admin: what is wrong, or that all is well. */
  message: string;
}

export interface WorkerHealth {
  workers: AdminWorker[];
  kinds: KindHealth[];
}

export function workerStatus(w: { lastSeenAt: Date; stoppedAt: Date | null }, now = Date.now()): WorkerStatus {
  if (w.stoppedAt) return "stopped";
  return now - w.lastSeenAt.getTime() <= ONLINE_WITHIN_MS ? "online" : "not_responding";
}

/** A capability the process reported as broken, e.g. Chromium failing to start. */
export function capabilityProblem(w: Pick<AdminWorker, "kind" | "capabilities">): string | null {
  if (w.kind === "video-worker" && w.capabilities.chromium && w.capabilities.chromium !== "ok") {
    return `Chromium could not start (${w.capabilities.chromium.replace(/^error:\s*/, "")})`;
  }
  if (w.kind === "worker" && w.capabilities.ffmpeg === "missing") return "FFmpeg is not installed";
  return null;
}

const duration = (ms: number) => {
  if (ms < 60_000) return "under a minute";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"}`;
  const h = Math.round(min / 60);
  return `${h} hour${h === 1 ? "" : "s"}`;
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Pure: turns the facts about one kind of worker into a status line. */
export function assessKind(input: {
  kind: WorkerKind;
  workers: Pick<AdminWorker, "kind" | "capabilities" | "status">[];
  queued: number;
  oldestQueuedAt: Date | null;
  now?: number;
}): KindHealth {
  const now = input.now ?? Date.now();
  const video = input.kind === "video-worker";
  const label = video ? "Video worker" : "Job worker";
  const noun = video ? "review video" : "job";
  const alive = input.workers.filter((w) => w.status === "online");
  const problems = alive.map(capabilityProblem).filter((p): p is string => !!p);
  const base = { kind: input.kind, label, online: alive.length, queued: input.queued, oldestQueuedAt: input.oldestQueuedAt };
  const waited = input.oldestQueuedAt ? now - input.oldestQueuedAt.getTime() : 0;

  if (alive.length === 0) {
    if (input.queued > 0) {
      return {
        ...base,
        severity: video ? "critical" : "warning",
        message: video
          ? `No video worker is running. ${plural(input.queued, noun)} waiting for ${duration(waited)} will not render until one starts.`
          : `No job worker is running. ${plural(input.queued, noun)} waiting for ${duration(waited)}; they only run when /api/cron/process-jobs is called.`,
      };
    }
    const seenBefore = input.workers.length > 0;
    return { ...base, severity: "ok", message: seenBefore ? "No worker is running. Nothing is waiting." : "No worker seen in the last 24 hours. Nothing is waiting." };
  }
  if (problems.length > 0 && problems.length === alive.length) {
    return { ...base, severity: video ? "critical" : "warning", message: `${problems[0]}.${input.queued > 0 ? ` ${plural(input.queued, noun)} waiting.` : ""}` };
  }
  if (input.queued > 0 && waited > SLOW_QUEUE_MS) {
    return { ...base, severity: "warning", message: `${plural(input.queued, noun)} waiting, the oldest for ${duration(waited)}. Workers are online, so they may be busy or stuck.` };
  }
  return { ...base, severity: "ok", message: `${plural(alive.length, "worker")} online.${input.queued > 0 ? ` ${plural(input.queued, noun)} waiting.` : ""}` };
}

export async function getWorkerHealth(now = new Date()): Promise<WorkerHealth> {
  const [rows, queue] = await Promise.all([
    db.select().from(workerHeartbeats).where(gte(workerHeartbeats.lastSeenAt, new Date(now.getTime() - LISTED_FOR_MS))),
    db.execute(sql`
      SELECT (type = ${JOB_TYPES.reviewVideo}) AS video, count(*)::int AS queued, min(created_at) AS oldest
      FROM jobs
      WHERE status = 'queued' AND run_at <= ${now.toISOString()}::timestamptz
      GROUP BY 1`),
  ]);

  const workers: AdminWorker[] = rows
    .map((r) => ({ ...r, status: workerStatus(r, now.getTime()) }))
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());

  const q = new Map(
    (queue.rows as unknown as { video: boolean; queued: number; oldest: Date | string | null }[]).map((r) => [
      r.video,
      { queued: r.queued, oldest: r.oldest ? new Date(r.oldest) : null },
    ])
  );
  const kinds = (["video-worker", "worker"] as const).map((kind) => {
    const found = q.get(kind === "video-worker");
    return assessKind({
      kind,
      workers: workers.filter((w) => w.kind === kind),
      queued: found?.queued ?? 0,
      oldestQueuedAt: found?.oldest ?? null,
      now: now.getTime(),
    });
  });
  return { workers, kinds };
}
