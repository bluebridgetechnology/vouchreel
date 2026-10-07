import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, internalError, notFound, validationError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { MAX_ADJUSTMENT, addAdjustment, listAdjustments } from "@/lib/admin/credit-adjustments";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["review", "ai"]),
  amount: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= MAX_ADJUSTMENT, { message: `A whole number other than zero, up to ${MAX_ADJUSTMENT} either way` }),
  reason: z.string().trim().min(1, "Give a reason").max(300),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/admin/users/:id/credits: this month's adjustments for the account. */
export async function GET(_: Request, { params }: RouteParams) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  try {
    return NextResponse.json({ adjustments: await listAdjustments(id) });
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to load adjustments");
  }
}

/**
 * POST /api/admin/users/:id/credits  { kind: "review" | "ai", amount, reason }
 * Adds (positive) or removes (negative) video credits for the current month, on top of the plan.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);

  try {
    const result = await addAdjustment(guard.session.user.id, id, parsed.data);
    if (!result.ok) return result.reason === "not_found" ? notFound(result.message) : badRequest(result.message);
    const { kind, amount, reason } = parsed.data;
    await logAdminAction({
      actorId: guard.session.user.id,
      action: "user.credits_adjusted",
      entityType: "user",
      entityId: id,
      summary: `${amount > 0 ? "Added" : "Removed"} ${Math.abs(amount)} ${kind === "ai" ? "AI video" : "review video"} credit${Math.abs(amount) === 1 ? "" : "s"} for ${result.email}`,
      changes: { kind, amount, reason },
    });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to adjust credits");
  }
}
