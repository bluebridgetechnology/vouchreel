import { z } from "zod";

/** -1 means unlimited; 0 or more is a hard cap. */
const limitNumber = z.number().int().min(-1).max(1_000_000);

export const planLimitsSchema = z.object({
  tier: z.enum(["free", "pro", "agency", "business", "custom"]).default("custom"),
  maxSpaces: limitNumber,
  maxTestimonialsPerSpace: limitNumber,
  /** Optional so existing clients that do not send it keep working; the stored default applies. */
  aiVideoCredits: limitNumber.optional(),
  reviewVideoCredits: limitNumber.optional(),
  removeWatermark: z.boolean(),
  canCustomizeBranding: z.boolean(),
  canUseAllTriggers: z.boolean(),
  canAccessAnalytics: z.boolean(),
  canUseCustomRules: z.boolean(),
  multiSeat: z.boolean(),
  whiteLabel: z.boolean(),
  exportableReports: z.boolean(),
});

/** Trimmed text where blank means "clear it" (null) and a missing key stays untouched (undefined). */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v ? v : null));

const planFields = z.object({
  name: z.string().trim().min(2, "Name is required").max(60),
  description: nullableText(200),
  badge: nullableText(30),
  /** Price in cents. */
  price: z.number().int().min(0).max(10_000_000),
  interval: z.enum(["month", "year"]),
  features: z.array(z.string().trim().min(1).max(160)).max(20),
  limits: planLimitsSchema,
  stripeProductId: nullableText(200),
  stripePriceId: nullableText(200),
  dodoProductId: nullableText(200),
  dodoPriceId: nullableText(200),
  sortOrder: z.number().int().min(0).max(1000),
  isActive: z.boolean(),
  isCustom: z.boolean(),
});

export const createPlanSchema = planFields
  .required({ name: true, price: true, interval: true, limits: true })
  .extend({
    features: planFields.shape.features.default([]),
    sortOrder: planFields.shape.sortOrder.default(0),
    isActive: planFields.shape.isActive.default(true),
    isCustom: planFields.shape.isCustom.default(false),
  })
  .transform((v) => ({
    ...v,
    description: v.description ?? null,
    badge: v.badge ?? null,
    stripeProductId: v.stripeProductId ?? null,
    stripePriceId: v.stripePriceId ?? null,
    dodoProductId: v.dodoProductId ?? null,
    dodoPriceId: v.dodoPriceId ?? null,
  }));

/** Partial update: only keys that were sent are present in the parsed result (no defaults injected). */
export const updatePlanSchema = planFields.partial();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
