import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/security/cron-auth";
import { reclaimStaleJobs } from "@/lib/jobs/queue";
import { drainQueue } from "@/lib/jobs/worker";

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
    const processed = await drainQueue({ maxJobs: 5 });
    return NextResponse.json({ success: true, reclaimed, processed });
  } catch (error) {
    console.error("Cron failed to process jobs:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
