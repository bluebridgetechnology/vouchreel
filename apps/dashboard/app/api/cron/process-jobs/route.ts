import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/security/cron-auth";
import { reclaimStaleJobs } from "@/lib/jobs/queue";
import { JOB_TYPES } from "@/lib/jobs/handlers";
import { drainQueue } from "@/lib/jobs/worker";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/process-jobs
 * Fallback for small deployments without a worker process: reclaims stale jobs and drains
 * the queue inline. Needs FFmpeg on this host, so it cannot run on Vercel. Prefer the worker.
 */
export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  try {
    const reclaimed = await reclaimStaleJobs();
    // This host has no Chromium, so it must not pick up video renders
    const processed = await drainQueue({ maxJobs: 5, except: [JOB_TYPES.reviewVideo] });
    return NextResponse.json({ success: true, reclaimed, processed });
  } catch (error) {
    log.error("Cron failed to process jobs:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
