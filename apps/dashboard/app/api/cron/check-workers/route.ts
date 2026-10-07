import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/security/cron-auth";
import { runWorkerAlerts } from "@/lib/admin/worker-alerts";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/check-workers
 * Emails the platform admins when a worker goes quiet or its queue is stuck, and again when it
 * recovers. Runs from the cron, not from a worker, so it still runs when the workers are down.
 */
export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ success: true, ...(await runWorkerAlerts()) });
  } catch (error) {
    console.error("Cron failed to check workers:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
