import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, badRequest, internalError, notFound, validationError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { REASON_MAX, REASON_MIN, takeDownVideo } from "@/lib/admin/moderation";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ kind: z.enum(["ai", "review"]), id: z.string().uuid() });
const bodySchema = z.object({ reason: z.string().trim().min(REASON_MIN, `Give a reason of at least ${REASON_MIN} characters`).max(REASON_MAX) });

interface RouteParams {
  params: Promise<{ kind: string; id: string }>;
}

/**
 * POST /api/admin/moderation/:kind/:id  { reason }
 * Takes a finished video down for good: deletes its stored file, clears its URL, records who and
 * why, and tells the owner (the reason is shown to them). Fails without changing anything when
 * the file cannot be deleted, so it can be retried.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const target = paramsSchema.safeParse(await params);
  if (!target.success) return notFound("Video not found");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return validationError("Validation failed", body.error.flatten().fieldErrors);

  try {
    const result = await takeDownVideo(target.data.kind, target.data.id, guard.session.user.id, body.data.reason);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound(result.message);
      if (result.reason === "storage_failed") return apiError(502, "INTERNAL_ERROR", result.message);
      return badRequest(result.message);
    }
    await logAdminAction({
      actorId: guard.session.user.id,
      action: "video.taken_down",
      entityType: "video",
      entityId: result.id,
      summary: `Took down ${result.kind === "ai" ? "AI" : "review"} video (${result.template}) of ${result.ownerEmail ?? "a deleted user"}`,
      changes: { kind: result.kind, spaceId: result.spaceId, reason: body.data.reason },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to take the video down");
  }
}
