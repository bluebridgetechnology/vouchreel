import { NextResponse } from "next/server";
import { badRequest, internalError, notFound } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { requestWorkerRestart } from "@/lib/admin/worker-control";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/workers/:workerId/restart
 * The worker finishes its running jobs and exits at its next heartbeat (within about 15 seconds,
 * plus however long its jobs take). Its supervisor, if any, starts it again.
 */
export async function POST(_: Request, { params }: { params: Promise<{ workerId: string }> }) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;
  const { workerId } = await params;
  try {
    const result = await requestWorkerRestart(workerId);
    if (!result.ok) return result.reason === "not_found" ? notFound(result.message) : badRequest(result.message);
    await logAdminAction({
      actorId: guard.session.user.id,
      action: "worker.restart_requested",
      entityType: "worker",
      entityId: workerId,
      summary: `Asked the ${result.kind === "video-worker" ? "video worker" : "job worker"} on ${result.hostname ?? "an unknown host"} to restart`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to request a restart");
  }
}
