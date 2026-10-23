import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { log } from "@/lib/log";
import type { PlanItem } from "@/app/(marketing)/pricing/pricing-table";

type PlanRow = typeof plans.$inferSelect;

/** What visitors may see of a plan: no payment-provider ids, no limits. */
export function toPlanItem(p: PlanRow): PlanItem {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    interval: p.interval as "month" | "year",
    features: (p.features as string[]) || [],
    description: p.description,
    badge: p.badge,
    sortOrder: p.sortOrder,
    isActive: p.isActive,
  };
}

/**
 * The active plans in the order set in the admin area. This is the one place the public pricing reads from: the
 * pricing page, the homepage and `GET /api/plans` all use it, so a price, a feature line or the order changed in
 * Admin > Plans & pricing shows up in all three on the next request (none of them cache the result).
 */
export async function queryActivePlans(): Promise<PlanItem[]> {
  const rows = await db.query.plans.findMany({
    where: eq(plans.isActive, true),
    orderBy: [asc(plans.sortOrder), asc(plans.price)],
  });
  return rows.map(toPlanItem);
}

/** The homepage's copy: an empty list when the database cannot be reached, so the page shows a link instead of failing. */
export async function loadLandingPlans(): Promise<PlanItem[]> {
  try {
    return await queryActivePlans();
  } catch (err) {
    log.warn("Could not read plans for the landing page:", err);
    return [];
  }
}

/** The plan a signed-in visitor is on, so its card says "Current plan". Null when they have none or it cannot be read. */
export async function getCurrentPlanId(userId: string): Promise<string | null> {
  try {
    const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) });
    return sub?.planId ?? null;
  } catch (err) {
    log.warn("Could not read the current plan for the landing page:", err);
    return null;
  }
}
