import type { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaces, testimonials } from "@/lib/db/schema";
import { apiError } from "@/lib/api/errors";
import { createNotification } from "@/lib/notifications/service";
import { formatLimit } from "./plan-limits";
import { getSubscriptionLimits } from "./subscription";

export interface TestimonialQuota {
  allowed: boolean;
  current: number;
  limit: number;
  ownerId: string;
}

/**
 * How many testimonials a space may hold. The limit comes from the space OWNER's plan, not
 * from whoever is acting (editors, API keys and public submissions all count against the
 * owner). Returns null when the space does not exist.
 */
export async function getTestimonialQuota(spaceId: string): Promise<TestimonialQuota | null> {
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
  if (!space) return null;

  const [row] = await db.select({ value: count() }).from(testimonials).where(eq(testimonials.spaceId, spaceId));
  const limits = await getSubscriptionLimits(space.ownerId);
  const current = row?.value ?? 0;
  return {
    allowed: current < limits.maxTestimonialsPerSpace,
    current,
    limit: limits.maxTestimonialsPerSpace,
    ownerId: space.ownerId,
  };
}

/**
 * Guard for every code path that creates a testimonial. Returns a 403 PLAN_LIMIT response
 * (and notifies the owner once a day) when the space is full, otherwise null.
 *
 *   const blocked = await enforceTestimonialLimit(spaceId);
 *   if (blocked) return blocked;
 */
export async function enforceTestimonialLimit(spaceId: string): Promise<NextResponse | null> {
  const quota = await getTestimonialQuota(spaceId);
  if (!quota || quota.allowed) return null;

  void createNotification({
    userId: quota.ownerId,
    type: "plan.limit_reached",
    title: "A space reached its testimonial limit",
    body: `Your plan allows ${formatLimit(quota.limit)} testimonials per space. Upgrade to add more.`,
    href: "/pricing",
    dedupeKey: `plan-limit:testimonials:${spaceId}`,
  });

  return apiError(
    403,
    "PLAN_LIMIT",
    `Testimonial limit reached (${quota.current}/${formatLimit(quota.limit)}). Upgrade your plan to add more.`,
    { details: { current: quota.current, limit: Number.isFinite(quota.limit) ? quota.limit : null } }
  );
}
