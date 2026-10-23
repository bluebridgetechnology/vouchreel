import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { log } from "@/lib/log";
import type { PlanItem } from "@/app/(marketing)/pricing/pricing-table";

/**
 * The active plans for the landing page's pricing section, in the order set in the admin area. Prices are edited
 * there, so they are read, not written into the page. An empty list when the database cannot be reached: the page
 * then shows a link to the pricing page instead of failing.
 */
export async function loadLandingPlans(): Promise<PlanItem[]> {
  try {
    const rows = await db.query.plans.findMany({
      where: eq(plans.isActive, true),
      orderBy: [asc(plans.sortOrder), asc(plans.price)],
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      interval: p.interval as "month" | "year",
      features: (p.features as string[]) || [],
      description: p.description,
      badge: p.badge,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
    }));
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
