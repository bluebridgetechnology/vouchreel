import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, internalError, notFound, validationError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { updateAdminUser } from "@/lib/admin/users";
import { setSuspended } from "@/lib/admin/suspension";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    isPlatformAdmin: z.boolean().optional(),
    planId: z.string().uuid().nullable().optional(),
    suspended: z.boolean().optional(),
    suspendedReason: z.string().trim().max(300).optional(),
  })
  .refine((b) => b.isPlatformAdmin !== undefined || b.planId !== undefined || b.suspended !== undefined, { message: "Provide isPlatformAdmin, planId or suspended" });

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/users/:id
 *   { isPlatformAdmin: boolean }  grant or revoke platform-admin access (never your own)
 *   { planId: uuid | null }       grant a plan by hand, or remove a manual grant
 *   { suspended: boolean, suspendedReason }  suspend (reason required) or restore an account
 * A plan billed by Stripe or Dodo is refused. Takes effect on the user's next request;
 * an admin flag change applies to an open session once its session cache expires.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);

  try {
    const actorId = guard.session.user.id;
    const { suspended, suspendedReason, ...access } = parsed.data;
    let changes: Record<string, { from: unknown; to: unknown }> = {};

    if (access.isPlatformAdmin !== undefined || access.planId !== undefined) {
      const result = await updateAdminUser(actorId, id, access);
      if (!result.ok) {
        return result.reason === "not_found" || result.reason === "plan_not_found" ? notFound(result.message) : badRequest(result.message);
      }
      changes = result.changes;
      const parts = Object.keys(result.changes).map((k) => (k === "isPlatformAdmin" ? (result.changes[k].to ? "granted admin" : "revoked admin") : "changed plan"));
      await logAdminAction({
        actorId,
        action: "user.updated",
        entityType: "user",
        entityId: id,
        summary: `${parts.join(" and ")} for ${result.email}`.replace(/^./, (c) => c.toUpperCase()),
        changes: result.changes,
      });
    }

    if (suspended !== undefined) {
      const result = await setSuspended(actorId, id, suspended, suspendedReason);
      if (!result.ok) return result.reason === "not_found" ? notFound(result.message) : badRequest(result.message);
      if (result.changed) {
        const change = { suspended: { from: !suspended, to: suspended }, ...(suspended ? { reason: { from: null, to: suspendedReason } } : {}) };
        changes = { ...changes, ...change };
        await logAdminAction({
          actorId,
          action: suspended ? "user.suspended" : "user.restored",
          entityType: "user",
          entityId: id,
          summary: `${suspended ? "Suspended" : "Restored"} ${result.email}`,
          changes: change,
        });
      }
    }
    return NextResponse.json({ ok: true, changes });
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to update user");
  }
}
