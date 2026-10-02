import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { internalError, validationError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { listAdminPlans, toAdminPlan } from "@/lib/admin/plans";
import { createPlanSchema } from "@/lib/validations/plans";

export const dynamic = "force-dynamic";

/** GET /api/admin/plans: every plan (active and archived) with subscriber counts and limits. */
export async function GET() {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ plans: await listAdminPlans() });
  } catch (err) {
    console.error("Failed to list plans:", err);
    return internalError("Failed to load plans");
  }
}

/** POST /api/admin/plans: create a plan (price in cents, limits with -1 = unlimited). */
export async function POST(request: Request) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const parsed = createPlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return validationError("Validation failed", parsed.error.flatten().fieldErrors);
  }

  try {
    const [row] = await db.insert(plans).values(parsed.data).returning();
    await logAdminAction({
      actorId: guard.session.user.id,
      action: "plan.created",
      entityType: "plan",
      entityId: row.id,
      summary: `Created plan ${row.name} (${row.interval}ly, ${(row.price / 100).toFixed(2)})`,
      changes: { plan: parsed.data },
    });
    return NextResponse.json({ plan: toAdminPlan(row, 0) }, { status: 201 });
  } catch (err) {
    console.error("Failed to create plan:", err);
    return internalError("Failed to create plan");
  }
}
