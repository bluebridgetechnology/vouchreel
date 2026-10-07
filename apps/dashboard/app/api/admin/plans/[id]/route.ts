import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { internalError, notFound, validationError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { diffFields, logAdminAction } from "@/lib/admin/audit";
import { getAdminPlan, toAdminPlan, getSubscriberCounts } from "@/lib/admin/plans";
import { updatePlanSchema } from "@/lib/validations/plans";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/admin/plans/:id */
export async function GET(_request: Request, { params }: RouteParams) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const plan = await getAdminPlan(id).catch(() => null);
  if (!plan) return notFound("Plan not found");
  return NextResponse.json({ plan });
}

/**
 * PATCH /api/admin/plans/:id
 * Updates price, copy, limits, provider ids, order or active status. Limit changes apply
 * immediately to every subscriber on the plan.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = updatePlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return validationError("Validation failed", parsed.error.flatten().fieldErrors);
  }
  if (Object.keys(parsed.data).length === 0) {
    return validationError("Nothing to update", { body: ["Provide at least one field"] });
  }

  try {
    const [before] = await db.select().from(plans).where(eq(plans.id, id));
    if (!before) return notFound("Plan not found");

    const [row] = await db.update(plans).set(parsed.data).where(eq(plans.id, id)).returning();
    const counts = await getSubscriberCounts([id]);

    const changes = diffFields(before as unknown as Record<string, unknown>, parsed.data as Record<string, unknown>);
    await logAdminAction({
      actorId: guard.session.user.id,
      action: "plan.updated",
      entityType: "plan",
      entityId: id,
      summary: `Updated plan ${row.name} (${Object.keys(changes).join(", ") || "no changes"})`,
      changes,
    });

    return NextResponse.json({ plan: toAdminPlan(row, counts.get(id) ?? 0) });
  } catch (err) {
    log.error("Failed to update plan:", err);
    return internalError("Failed to update plan");
  }
}

/**
 * DELETE /api/admin/plans/:id
 * Archives the plan (isActive = false): it disappears from pricing and checkout while
 * existing subscribers keep their entitlements. Plans are never hard-deleted.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  try {
    const [row] = await db.update(plans).set({ isActive: false }).where(eq(plans.id, id)).returning();
    if (!row) return notFound("Plan not found");

    const counts = await getSubscriberCounts([id]);
    await logAdminAction({
      actorId: guard.session.user.id,
      action: "plan.archived",
      entityType: "plan",
      entityId: id,
      summary: `Archived plan ${row.name} (${counts.get(id) ?? 0} subscribers keep access)`,
    });
    return NextResponse.json({ plan: toAdminPlan(row, counts.get(id) ?? 0) });
  } catch (err) {
    log.error("Failed to archive plan:", err);
    return internalError("Failed to archive plan");
  }
}
