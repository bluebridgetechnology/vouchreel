import { NextResponse } from "next/server";
import { syncAllActiveReviewSources } from "@/lib/reviews/sync";
import { authorizeCron } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/sync-reviews
 * Periodic scheduled task to sync active review sources respecting rate limits.
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
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("Cron reviews sync failed:", error);
    return NextResponse.json(
      { error: "Internal server error during sync" },
      { status: 500 }
    );
  }
}
