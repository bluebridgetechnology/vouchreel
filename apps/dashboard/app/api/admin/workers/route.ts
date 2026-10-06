import { NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { getWorkerHealth } from "@/lib/admin/workers";

export const dynamic = "force-dynamic";

/** GET /api/admin/workers: job workers seen in the last 24 hours with their status, and per-kind queue health. */
export async function GET() {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json(await getWorkerHealth());
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to load workers");
  }
}
