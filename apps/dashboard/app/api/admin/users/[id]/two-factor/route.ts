import { NextResponse } from "next/server";
import { badRequest, internalError, notFound } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { resetTwoFactor } from "@/lib/admin/two-factor-reset";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/users/:id/two-factor
 * Turns two-factor sign-in off for someone locked out. Audited. Never allowed on your own account.
 */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  try {
    const result = await resetTwoFactor(guard.session.user.id, id);
    if (!result.ok) return result.reason === "not_found" ? notFound(result.message) : badRequest(result.message);
    await logAdminAction({
      actorId: guard.session.user.id,
      action: "user.two_factor_reset",
      entityType: "user",
      entityId: id,
      summary: `Reset two-factor sign-in for ${result.email}`,
      changes: { wasEnabled: result.wasEnabled },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to reset two-factor sign-in");
  }
}
