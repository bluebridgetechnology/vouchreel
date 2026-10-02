import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { subscriptions, plans } from "../db/schema";
import type { SubscriptionStatus } from "./types";
import { PLAN_LIMIT_PRESETS, normalizeLimits, type PlanLimits } from "./plan-limits";

export type { PlanLimits } from "./plan-limits";

/**
 * Retrieves the user's current subscription and associated plan from the database.
 */
export async function getUserSubscription(userId: string) {
  if (!db.query?.subscriptions) {
    return null;
  }

  const userSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!userSub) {
    return null;
  }

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, userSub.planId),
  });

  return {
    subscription: userSub,
    plan,
  };
}

/**
 * Checks whether the user has an active, valid subscription (active or trialing).
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  if (!db.query?.subscriptions) {
    return false;
  }

  const userSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!userSub) {
    return false;
  }

  const validStatuses: SubscriptionStatus[] = ["active", "trialing"];
  return validStatuses.includes(userSub.status as SubscriptionStatus);
}

/**
 * Limits for users without an active subscription: the active free plan configured in
 * the admin area (so admins can tune the free tier), else the built-in free preset.
 */
async function getFreeTierLimits(): Promise<PlanLimits> {
  try {
    const freePlan = await db.query.plans.findFirst({
      where: and(eq(plans.price, 0), eq(plans.isActive, true)),
      orderBy: asc(plans.sortOrder),
    });
    if (freePlan?.limits) return normalizeLimits(freePlan.limits, freePlan.name);
  } catch {
    // fall through to the preset
  }
  return PLAN_LIMIT_PRESETS.free;
}

/**
 * Returns feature gating limits for a given user, read from their active plan's
 * `limits` (edited in /admin). Changing a plan's limits takes effect immediately for
 * everyone on it. Legacy plans without stored limits use name-based presets.
 */
export async function getSubscriptionLimits(userId: string): Promise<PlanLimits> {
  if (!db.query?.subscriptions) {
    return PLAN_LIMIT_PRESETS.free;
  }

  const userSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!userSub || (userSub.status !== "active" && userSub.status !== "trialing")) {
    return getFreeTierLimits();
  }

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, userSub.planId),
  });

  if (!plan) {
    return getFreeTierLimits();
  }

  return normalizeLimits(plan.limits, plan.name);
}

/**
 * Checks whether a user is allowed to create another space under their plan.
 */
export async function canCreateSpace(
  userId: string,
  currentSpaceCount: number
): Promise<boolean> {
  const limits = await getSubscriptionLimits(userId);
  return currentSpaceCount < limits.maxSpaces;
}

/**
 * Checks whether a user is allowed to add another testimonial under their plan.
 */
export async function canAddTestimonial(
  userId: string,
  currentTestimonialCount: number
): Promise<boolean> {
  const limits = await getSubscriptionLimits(userId);
  return currentTestimonialCount < limits.maxTestimonialsPerSpace;
}
