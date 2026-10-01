import { getSubscriptionLimits } from "@/lib/payments/subscription";

export type FeatureKey =
  | "white-label"
  | "multi-seat"
  | "agency-dashboard"
  | "exportable-reports"
  | "advanced-analytics"
  | "custom-rules"
  | "remove-watermark"
  | "unlimited-testimonials"
  | "unlimited-spaces";

/**
 * Checks whether a user has access to a specific tiered feature according
 * to their current active subscription plan.
 *
 * @param userOrId - User object with an id or raw user id string
 * @param feature - Feature key to check entitlement for
 * @returns boolean indicating if the user has access
 *
 * @example
 * ```ts
 * const allowed = await canAccess(session.user, "white-label");
 * if (!allowed) return forbidden("White-label features require an Agency subscription");
 * ```
 */
export async function canAccess(
  userOrId: { id: string } | string,
  feature: FeatureKey
): Promise<boolean> {
  const userId = typeof userOrId === "string" ? userOrId : userOrId?.id;
  if (!userId) {
    return false;
  }

  const limits = await getSubscriptionLimits(userId);

  switch (feature) {
    case "white-label":
      return Boolean(limits.whiteLabel);

    case "multi-seat":
      return Boolean(limits.multiSeat);

    case "agency-dashboard":
      // Agency dashboard is an agency-tier feature (or pro users evaluating)
      return Boolean(limits.whiteLabel || limits.multiSeat);

    case "exportable-reports":
      return Boolean(limits.exportableReports);

    case "advanced-analytics":
      return Boolean(limits.canAccessAnalytics);

    case "custom-rules":
      return Boolean(limits.canUseCustomRules);

    case "remove-watermark":
      return Boolean(limits.removeWatermark);

    case "unlimited-testimonials":
      return limits.maxTestimonialsPerSpace > 10;

    case "unlimited-spaces":
      return limits.maxSpaces > 10;

    default:
      return false;
  }
}
