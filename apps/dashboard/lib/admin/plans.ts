import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { normalizeLimits, serializeLimits } from "@/lib/payments/plan-limits";

export interface AdminPlan {
  id: string;
  name: string;
  description: string | null;
  badge: string | null;
  price: number;
  interval: "month" | "year";
  features: string[];
  /** Stored form: -1 means unlimited. Always complete (legacy plans are filled from presets). */
  limits: Record<string, number | boolean | string>;
  stripeProductId: string | null;
  stripePriceId: string | null;
  dodoProductId: string | null;
  dodoPriceId: string | null;
  sortOrder: number;
  isActive: boolean;
  isCustom: boolean;
  subscriberCount: number;
  createdAt: string;
}

type PlanRow = typeof plans.$inferSelect;

export function toAdminPlan(row: PlanRow, subscriberCount: number): AdminPlan {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    badge: row.badge,
    price: row.price,
    interval: row.interval,
    features: (row.features as string[] | null) ?? [],
    limits: serializeLimits(normalizeLimits(row.limits, row.name)),
    stripeProductId: row.stripeProductId,
    stripePriceId: row.stripePriceId,
    dodoProductId: row.dodoProductId,
    dodoPriceId: row.dodoPriceId,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    isCustom: row.isCustom,
    subscriberCount,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Active and trialing subscribers per plan id. */
export async function getSubscriberCounts(planIds?: string[]): Promise<Map<string, number>> {
  const conditions = [inArray(subscriptions.status, ["active", "trialing"])];
  if (planIds) {
    if (planIds.length === 0) return new Map();
    conditions.push(inArray(subscriptions.planId, planIds));
  }
  const rows = await db
    .select({ planId: subscriptions.planId, value: count() })
    .from(subscriptions)
    .where(and(...conditions))
    .groupBy(subscriptions.planId);
  return new Map(rows.map((r) => [r.planId, r.value]));
}

export async function listAdminPlans(): Promise<AdminPlan[]> {
  const rows = await db.select().from(plans).orderBy(asc(plans.sortOrder), asc(plans.price));
  const counts = await getSubscriberCounts();
  return rows.map((row) => toAdminPlan(row, counts.get(row.id) ?? 0));
}

export async function getAdminPlan(id: string): Promise<AdminPlan | null> {
  const [row] = await db.select().from(plans).where(eq(plans.id, id));
  if (!row) return null;
  const counts = await getSubscriberCounts([id]);
  return toAdminPlan(row, counts.get(id) ?? 0);
}
