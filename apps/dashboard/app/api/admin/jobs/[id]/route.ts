import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, internalError, notFound, validationError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { cancelJob, retryJob } from "@/lib/admin/jobs";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["retry", "cancel"]) });

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/jobs/:id  { action: "retry" | "cancel" }
 * retry: a failed job goes back to the queue (and its video to queued).
 * cancel: a queued job, or a running job whose worker died, is stopped and its video failed.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);

  try {
    const { action } = parsed.data;
    const result = action === "retry" ? await retryJob(id) : await cancelJob(id);
    if (!result.ok) return result.reason === "not_found" ? notFound(result.message) : badRequest(result.message);

    await logAdminAction({
      actorId: guard.session.user.id,
      action: `job.${action}`,
      entityType: "job",
      entityId: id,
      summary: `${action === "retry" ? "Retried" : "Cancelled"} ${result.job.type} job${result.job.videoId ? ` (video ${result.job.videoId})` : ""}`,
      changes: { type: result.job.type, videoId: result.job.videoId },
    });
    return NextResponse.json({ job: result.job });
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to update job");
  }
}
