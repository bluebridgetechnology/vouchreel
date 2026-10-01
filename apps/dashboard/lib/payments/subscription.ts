import { eq } from "drizzle-orm";
import { db } from "../db";
import { subscriptions, plans } from "../db/schema";
import type { SubscriptionStatus } from "./types";

export interface PlanLimits {
  tier: "free" | "pro" | "agency" | "business";
  maxSpaces: number;
  maxTestimonialsPerSpace: number;
  removeWatermark: boolean;
  canCustomizeBranding: boolean;
  canUseAllTriggers: boolean;
  canAccessAnalytics: boolean;
  canUseCustomRules: boolean;
  multiSeat: boolean;
  whiteLabel: boolean;
  exportableReports: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    tier: "free",
    maxSpaces: 1,
    maxTestimonialsPerSpace: 3,
    removeWatermark: false,
    canCustomizeBranding: false,
    canUseAllTriggers: false,
    canAccessAnalytics: false,
    canUseCustomRules: false,
    multiSeat: false,
    whiteLabel: false,
    exportableReports: false,
  },
  pro: {
    tier: "pro",
    maxSpaces: 5,
    maxTestimonialsPerSpace: Infinity,
    removeWatermark: true,
    canCustomizeBranding: true,
    canUseAllTriggers: true,
    canAccessAnalytics: true,
    canUseCustomRules: true,
    multiSeat: false,
    whiteLabel: false,
    exportableReports: true,
  },
  agency: {
    tier: "agency",
    maxSpaces: Infinity,
    maxTestimonialsPerSpace: Infinity,
    removeWatermark: true,
    canCustomizeBranding: true,
    canUseAllTriggers: true,
    canAccessAnalytics: true,
    canUseCustomRules: true,
    multiSeat: true,
    whiteLabel: true,
    exportableReports: true,
  },
  business: {
    tier: "business",
    maxSpaces: Infinity,
    maxTestimonialsPerSpace: Infinity,
    removeWatermark: true,
    canCustomizeBranding: true,
    canUseAllTriggers: true,
    canAccessAnalytics: true,
    canUseCustomRules: true,
    multiSeat: true,
    whiteLabel: true,
    exportableReports: true,
  },
};

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
 * Returns feature gating limits for a given user.
 * Defaults to Free tier limits if no subscription exists or subscription is not active.
 */
export async function getSubscriptionLimits(userId: string): Promise<PlanLimits> {
  if (!db.query?.subscriptions) {
    return PLAN_LIMITS.free;
  }

  const userSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!userSub || (userSub.status !== "active" && userSub.status !== "trialing")) {
    return PLAN_LIMITS.free;
  }

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, userSub.planId),
  });

  if (!plan) {
    return PLAN_LIMITS.free;
  }

  const normalizedName = plan.name.toLowerCase().trim();
  if (normalizedName.includes("agency")) {
    return PLAN_LIMITS.agency;
  }
  if (normalizedName.includes("business")) {
    return PLAN_LIMITS.business;
  }
  if (normalizedName.includes("pro")) {
    return PLAN_LIMITS.pro;
  }

  return PLAN_LIMITS.free;
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
