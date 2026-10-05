import { and, count, desc, eq, inArray, lt, min, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { generatedVideos, jobs, reviewVideos, spaces, user } from "@/lib/db/schema";
import { STALE_LOCK_MS } from "@/lib/jobs/queue";
import { JOB_TYPES } from "@/lib/jobs/handlers";
import { notifySpaceOwner } from "@/lib/notifications/service";

/**
 * Platform-admin view of the background job queue and the videos it renders. Read helpers plus
 * the two repair actions (retry, cancel). This file must stay free of Remotion/FFmpeg imports:
 * it runs in the web app, not in a worker.
 */

export type JobStatus = "queued" | "running" | "done" | "failed";
const STATUSES: JobStatus[] = ["queued", "running", "done", "failed"];

export interface AdminJobRow {
  id: string;
  type: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: Date;
  completedAt: Date | null;
  /** The video the job renders, when its payload names one. */
  videoId: string | null;
  /** A running job whose lock is older than the stale limit: its worker is presumed dead. */
  stale: boolean;
}

export interface JobOverview {
  byStatus: Record<JobStatus, number>;
  /** Count per job type and status, for the summary table. */
  byType: { type: string; status: JobStatus; count: number }[];
  oldestQueuedAt: Date | null;
  staleRunning: number;
  /** Most recent failed jobs, newest first. */
  failed: AdminJobRow[];
  /** Jobs running or queued that need attention first (stale locks), then the rest by age. */
  active: AdminJobRow[];
}

function toRow(row: typeof jobs.$inferSelect, now = Date.now()): AdminJobRow {
  const videoId = typeof row.payload?.videoId === "string" ? row.payload.videoId : null;
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAt: row.runAt,
    lockedAt: row.lockedAt,
    lockedBy: row.lockedBy,
    lastError: row.lastError,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    videoId,
    stale: row.status === "running" && !!row.lockedAt && now - row.lockedAt.getTime() > STALE_LOCK_MS,
  };
}

export async function getJobOverview(limit = 50): Promise<JobOverview> {
  const [typeRows, oldest, failedRows, activeRows] = await Promise.all([
    db.select({ type: jobs.type, status: jobs.status, value: count() }).from(jobs).groupBy(jobs.type, jobs.status),
    db.select({ at: min(jobs.createdAt) }).from(jobs).where(eq(jobs.status, "queued")),
    db.select().from(jobs).where(eq(jobs.status, "failed")).orderBy(desc(jobs.completedAt)).limit(limit),
    db.select().from(jobs).where(inArray(jobs.status, ["queued", "running"])).orderBy(jobs.createdAt).limit(limit),
  ]);

  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<JobStatus, number>;
  for (const r of typeRows) byStatus[r.status] += r.value;

  const now = Date.now();
  const active = activeRows.map((r) => toRow(r, now)).sort((a, b) => Number(b.stale) - Number(a.stale));
  return {
    byStatus,
    byType: typeRows.map((r) => ({ type: r.type, status: r.status, count: r.value })).sort((a, b) => a.type.localeCompare(b.type)),
    oldestQueuedAt: oldest[0]?.at ?? null,
    staleRunning: active.filter((j) => j.stale).length,
    failed: failedRows.map((r) => toRow(r, now)),
    active,
  };
}

export interface AdminVideoRow {
  kind: "review" | "ai";
  id: string;
  status: string;
  template: string;
  spaceName: string;
  ownerEmail: string | null;
  creditsUsed: number;
  error: string | null;
  createdAt: Date;
  /** Render time in ms, when recorded (review videos only). */
  renderMs: number | null;
}

/** The most recent review videos and AI videos across all accounts, newest first. */
export async function listAdminVideos(limit = 50): Promise<AdminVideoRow[]> {
  const [review, ai] = await Promise.all([
    db
      .select({
        id: reviewVideos.id,
        status: reviewVideos.status,
        template: reviewVideos.template,
        spaceName: spaces.name,
        ownerEmail: user.email,
        creditsUsed: reviewVideos.creditsUsed,
        error: reviewVideos.error,
        createdAt: reviewVideos.createdAt,
        renderMs: reviewVideos.renderMs,
      })
      .from(reviewVideos)
      .innerJoin(spaces, eq(reviewVideos.spaceId, spaces.id))
      .leftJoin(user, eq(spaces.ownerId, user.id))
      .orderBy(desc(reviewVideos.createdAt))
      .limit(limit),
    db
      .select({
        id: generatedVideos.id,
        status: generatedVideos.status,
        template: generatedVideos.template,
        spaceName: spaces.name,
        ownerEmail: user.email,
        creditsUsed: generatedVideos.creditsUsed,
        error: generatedVideos.error,
        createdAt: generatedVideos.createdAt,
      })
      .from(generatedVideos)
      .innerJoin(spaces, eq(generatedVideos.spaceId, spaces.id))
      .leftJoin(user, eq(spaces.ownerId, user.id))
      .orderBy(desc(generatedVideos.createdAt))
      .limit(limit),
  ]);

  return [
    ...review.map((r): AdminVideoRow => ({ kind: "review", ...r })),
    ...ai.map((r): AdminVideoRow => ({ kind: "ai", ...r, renderMs: null })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export type JobActionResult =
  | { ok: true; job: AdminJobRow }
  | { ok: false; reason: "not_found" | "invalid_state"; message: string };

async function findJob(id: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
  return row ?? null;
}

/**
 * Puts a failed job back in the queue with a fresh attempt count, and its video back to
 * `queued`. The video holds a credit again from that moment (a failed render had refunded it),
 * even if that takes the owner past their allowance: this is an admin repair action.
 */
export async function retryJob(id: string): Promise<JobActionResult> {
  const [row] = await db
    .update(jobs)
    .set({ status: "queued", attempts: 0, runAt: new Date(), lastError: null, completedAt: null, lockedAt: null, lockedBy: null })
    .where(and(eq(jobs.id, id), eq(jobs.status, "failed")))
    .returning();
  if (!row) {
    const existing = await findJob(id);
    return existing
      ? { ok: false, reason: "invalid_state", message: `Only failed jobs can be retried (this one is ${existing.status}).` }
      : { ok: false, reason: "not_found", message: "Job not found." };
  }

  const videoId = typeof row.payload?.videoId === "string" ? row.payload.videoId : null;
  if (videoId) {
    const reset = { status: "queued" as const, error: null, completedAt: null };
    if (row.type === JOB_TYPES.reviewVideo) {
      await db.update(reviewVideos).set(reset).where(and(eq(reviewVideos.id, videoId), eq(reviewVideos.status, "failed")));
    } else if (row.type === JOB_TYPES.aiVideo) {
      await db.update(generatedVideos).set(reset).where(and(eq(generatedVideos.id, videoId), eq(generatedVideos.status, "failed")));
    }
  }
  return { ok: true, job: toRow(row) };
}

/**
 * Stops a job that has not started (queued) or whose worker died (running with a stale lock).
 * A job that is running normally cannot be cancelled: its worker would overwrite the result.
 * The linked video is marked failed, which refunds its credit, and the owner is told.
 */
export async function cancelJob(id: string): Promise<JobActionResult> {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  const [row] = await db
    .update(jobs)
    .set({ status: "failed", lastError: "Cancelled by an administrator", completedAt: new Date(), lockedAt: null, lockedBy: null })
    .where(
      and(
        eq(jobs.id, id),
        sql`(${jobs.status} = 'queued' OR (${jobs.status} = 'running' AND ${lt(jobs.lockedAt, staleBefore)}))`
      )
    )
    .returning();
  if (!row) {
    const existing = await findJob(id);
    if (!existing) return { ok: false, reason: "not_found", message: "Job not found." };
    const why = existing.status === "running" ? "It is running normally; wait for it to finish or for its lock to go stale." : `It is already ${existing.status}.`;
    return { ok: false, reason: "invalid_state", message: `This job cannot be cancelled. ${why}` };
  }

  const videoId = typeof row.payload?.videoId === "string" ? row.payload.videoId : null;
  if (videoId) await failVideo(row.type, videoId, "This video was cancelled by our team.");
  return { ok: true, job: toRow(row) };
}

async function failVideo(type: string, videoId: string, message: string): Promise<void> {
  const holding = ["queued", "rendering"] as const;
  const patch = { status: "failed" as const, error: message, completedAt: new Date() };
  const failed =
    type === JOB_TYPES.reviewVideo
      ? await db
          .update(reviewVideos)
          .set(patch)
          .where(and(eq(reviewVideos.id, videoId), inArray(reviewVideos.status, [...holding])))
          .returning({ spaceId: reviewVideos.spaceId })
      : type === JOB_TYPES.aiVideo
        ? await db
            .update(generatedVideos)
            .set(patch)
            .where(and(eq(generatedVideos.id, videoId), inArray(generatedVideos.status, [...holding])))
            .returning({ spaceId: generatedVideos.spaceId })
        : [];
  if (failed[0]) {
    void notifySpaceOwner(failed[0].spaceId, {
      type: type === JOB_TYPES.reviewVideo ? "review_video.failed" : "ai_video.failed",
      title: "A video could not be created",
      body: `${message} Your credit was not used.`,
      href: `/spaces/${failed[0].spaceId}`,
      metadata: { videoId },
    });
  }
}
