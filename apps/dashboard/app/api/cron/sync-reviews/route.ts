import { NextResponse } from "next/server";
import { syncAllActiveReviewSources } from "@/lib/reviews/sync";
import { purgeStaleReviewText } from "@/lib/reviews/retention";
import { authorizeCron } from "@/lib/security/cron-auth";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/sync-reviews
 * Periodic scheduled task to sync active review sources respecting rate limits, then to remove third-party review
 * text older than REVIEW_TEXT_RETENTION_DAYS (lib/reviews/retention.ts).
 */
export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  try {
    const result = await syncAllActiveReviewSources();
    // After the sync, so text the providers still return has just been refreshed. A purge failure must not fail the sync.
    let purged = 0;
    try {
      purged = await purgeStaleReviewText();
    } catch (error) {
      log.error("Review text purge failed:", error);
    }
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      purged,
      ...result,
    });
  } catch (error) {
    log.error("Cron reviews sync failed:", error);
    return NextResponse.json(
      { error: "Internal server error during sync" },
      { status: 500 }
    );
  }
}
