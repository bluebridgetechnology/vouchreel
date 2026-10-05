import { NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { getJobOverview, listAdminVideos } from "@/lib/admin/jobs";

export const dynamic = "force-dynamic";

/** GET /api/admin/jobs: queue summary, failed and active jobs, and recent videos across all accounts. */
export async function GET() {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  try {
    const [overview, videos] = await Promise.all([getJobOverview(), listAdminVideos()]);
    return NextResponse.json({ overview, videos });
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to load jobs");
  }
}
