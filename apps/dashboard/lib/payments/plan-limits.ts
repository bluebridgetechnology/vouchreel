/**
 * Plan entitlements. The source of truth is the `plans.limits` JSON column, edited by
 * platform admins in /admin. In storage, -1 means "unlimited" (JSON has no Infinity);
 * in code unlimited is Infinity so comparisons like `count < limit` just work.
 *
 * The presets below are NOT used to gate features for plans that have limits saved.
 * They seed new plans, pre-fill the admin form, and are the fallback for legacy rows
 * and for users with no subscription when no active free plan exists.
 */

export type PlanTier = "free" | "pro" | "agency" | "business" | "custom";

export interface PlanLimits {
  tier: PlanTier;
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

/** Shape persisted in plans.limits (unlimited = -1). */
export type StoredPlanLimits = {
  [K in keyof PlanLimits]?: PlanLimits[K];
};

export const NUMERIC_LIMIT_KEYS = ["maxSpaces", "maxTestimonialsPerSpace"] as const;

export const BOOLEAN_LIMIT_KEYS = [
  "removeWatermark",
  "canCustomizeBranding",
  "canUseAllTriggers",
  "canAccessAnalytics",
  "canUseCustomRules",
  "multiSeat",
  "whiteLabel",
  "exportableReports",
] as const;

const none = {
  removeWatermark: false,
  canCustomizeBranding: false,
  canUseAllTriggers: false,
  canAccessAnalytics: false,
  canUseCustomRules: false,
  multiSeat: false,
  whiteLabel: false,
  exportableReports: false,
};

const growth = {
  removeWatermark: true,
  canCustomizeBranding: true,
  canUseAllTriggers: true,
  canAccessAnalytics: true,
  canUseCustomRules: true,
  exportableReports: true,
};

export const PLAN_LIMIT_PRESETS: Record<Exclude<PlanTier, "custom">, PlanLimits> = {
  free: { tier: "free", maxSpaces: 1, maxTestimonialsPerSpace: 3, ...none },
  pro: { tier: "pro", maxSpaces: 5, maxTestimonialsPerSpace: Infinity, ...none, ...growth },
  agency: {
    tier: "agency",
    maxSpaces: Infinity,
    maxTestimonialsPerSpace: Infinity,
    ...none,
    ...growth,
    multiSeat: true,
    whiteLabel: true,
  },
  business: {
    tier: "business",
    maxSpaces: Infinity,
    maxTestimonialsPerSpace: Infinity,
    ...none,
    ...growth,
    multiSeat: true,
    whiteLabel: true,
  },
};

/** Best-guess tier for legacy plans that have no stored limits. */
export function tierFromName(name: string): Exclude<PlanTier, "custom"> {
  const n = name.toLowerCase();
  if (n.includes("agency")) return "agency";
  if (n.includes("business")) return "business";
  if (n.includes("pro")) return "pro";
  return "free";
}

const toRuntimeNumber = (value: unknown, fallback: number): number => {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return value < 0 ? Infinity : value;
};

/** Stored JSON (or null for legacy plans) -> runtime limits with Infinity for unlimited. */
export function normalizeLimits(raw: unknown, planName: string): PlanLimits {
  const base = PLAN_LIMIT_PRESETS[tierFromName(planName)];
  if (!raw || typeof raw !== "object") return base;
  const stored = raw as Record<string, unknown>;
  const result: PlanLimits = { ...base };
  if (typeof stored.tier === "string") result.tier = stored.tier as PlanTier;
  for (const key of NUMERIC_LIMIT_KEYS) result[key] = toRuntimeNumber(stored[key], base[key]);
  for (const key of BOOLEAN_LIMIT_KEYS) {
    if (typeof stored[key] === "boolean") result[key] = stored[key] as boolean;
  }
  return result;
}

/** Runtime limits -> JSON-safe stored form (Infinity becomes -1). */
export function serializeLimits(limits: PlanLimits): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = { tier: limits.tier };
  for (const key of NUMERIC_LIMIT_KEYS) out[key] = Number.isFinite(limits[key]) ? limits[key] : -1;
  for (const key of BOOLEAN_LIMIT_KEYS) out[key] = limits[key];
  return out;
}

/** "Unlimited" or the number, for UI and error messages. */
export function formatLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : "Unlimited";
}
