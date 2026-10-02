import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { plans } from "./schema";
import { PLAN_LIMIT_PRESETS, serializeLimits, tierFromName } from "@/lib/payments/plan-limits";

const PLAN_COPY: Record<string, { description: string; badge: string | null; sortOrder: number }> = {
  free: { description: "Perfect for side projects and evaluating Vouchreel.", badge: null, sortOrder: 0 },
  pro: { description: "Everything you need to collect and showcase high-converting videos.", badge: "Most popular", sortOrder: 10 },
  agency: { description: "For agencies and teams managing multiple client brands with white-label proof.", badge: null, sortOrder: 20 },
  business: { description: "For fast-growing companies and agencies demanding maximum power.", badge: null, sortOrder: 30 },
};

/** Marketing copy, ordering and entitlements for a default plan. Entitlements are only written when a plan has none, so admin edits survive re-seeding. */
function defaultsFor(name: string) {
  const tier = tierFromName(name);
  return { ...PLAN_COPY[tier], limits: serializeLimits(PLAN_LIMIT_PRESETS[tier]) };
}

export const DEFAULT_PLANS = [
  {
    name: "Free",
    price: 0,
    interval: "month" as const,
    features: [
      "1 space",
      "3 testimonials",
      "Basic analytics (views & plays)",
      "Standard embed widget",
      "Vouchreel branding",
    ],
    stripeProductId: null,
    stripePriceId: null,
    dodoProductId: null,
    dodoPriceId: null,
    isActive: true,
  },
  {
    name: "Pro",
    price: 1900, // $19.00
    interval: "month" as const,
    features: [
      "5 spaces",
      "Unlimited testimonials",
      "Full analytics & conversion tracking",
      "A/B testing & all triggers",
      "Custom branding colors",
      "Remove Vouchreel watermark",
    ],
    stripeProductId: "prod_pro_monthly",
    stripePriceId: "price_pro_monthly",
    dodoProductId: "pdt_pro_monthly",
    dodoPriceId: "price_pro_monthly",
    isActive: true,
  },
  {
    name: "Pro",
    price: 19000, // $190.00 (2 months free)
    interval: "year" as const,
    features: [
      "5 spaces",
      "Unlimited testimonials",
      "Full analytics & conversion tracking",
      "A/B testing & all triggers",
      "Custom branding colors",
      "Remove Vouchreel watermark",
      "2 months free included",
    ],
    stripeProductId: "prod_pro_yearly",
    stripePriceId: "price_pro_yearly",
    dodoProductId: "pdt_pro_yearly",
    dodoPriceId: "price_pro_yearly",
    isActive: true,
  },
  {
    name: "Agency",
    price: 9900, // $99.00
    interval: "month" as const,
    features: [
      "Unlimited spaces",
      "Multi-seat team members with RBAC",
      "Full white-label branding & custom domain",
      "Agency multi-client cockpit",
      "Exportable executive ROI reports (PDF & CSV)",
      "Priority customer support",
    ],
    stripeProductId: "prod_agency_monthly",
    stripePriceId: "price_agency_monthly",
    dodoProductId: "pdt_agency_monthly",
    dodoPriceId: "price_agency_monthly",
    isActive: true,
  },
  {
    name: "Agency",
    price: 99000, // $990.00 (2 months free)
    interval: "year" as const,
    features: [
      "Unlimited spaces",
      "Multi-seat team members with RBAC",
      "Full white-label branding & custom domain",
      "Agency multi-client cockpit",
      "Exportable executive ROI reports (PDF & CSV)",
      "Priority customer support",
      "2 months free included",
    ],
    stripeProductId: "prod_agency_yearly",
    stripePriceId: "price_agency_yearly",
    dodoProductId: "pdt_agency_yearly",
    dodoPriceId: "price_agency_yearly",
    isActive: true,
  },
  {
    name: "Business",
    price: 4900,
    interval: "month" as const,
    features: [
      "Unlimited spaces",
      "Multi-seat accounts",
      "White-label branding",
      "Priority support",
    ],
    stripeProductId: "prod_biz_monthly",
    stripePriceId: "price_biz_monthly",
    dodoProductId: "pdt_biz_monthly",
    dodoPriceId: "price_biz_monthly",
    isActive: false, // Legacy tier superseded by Agency
  },
];

export async function seedPlans() {
  console.log("Seeding subscription plans...");
  const results = [];

  for (const plan of DEFAULT_PLANS) {
    const existing = await db.query.plans.findFirst({
      where: and(eq(plans.name, plan.name), eq(plans.interval, plan.interval)),
    });

    if (existing) {
      console.log(`Plan ${plan.name} (${plan.interval}) already exists. Updating...`);
      const [updated] = await db
        .update(plans)
        .set({
          ...(existing.limits ? {} : { limits: defaultsFor(plan.name).limits }),
          description: existing.description ?? defaultsFor(plan.name).description,
          badge: existing.badge ?? defaultsFor(plan.name).badge,
          price: plan.price,
          features: plan.features,
          stripeProductId: plan.stripeProductId,
          stripePriceId: plan.stripePriceId,
          dodoProductId: plan.dodoProductId,
          dodoPriceId: plan.dodoPriceId,
          isActive: plan.isActive,
        })
        .where(eq(plans.id, existing.id))
        .returning();
      results.push(updated);
    } else {
      console.log(`Creating plan ${plan.name} (${plan.interval})...`);
      const [inserted] = await db.insert(plans).values({ ...plan, ...defaultsFor(plan.name) }).returning();
      results.push(inserted);
    }
  }

  console.log(`Successfully seeded ${results.length} plans.`);
  return results;
}

if (process.argv[1]?.includes("seed-plans")) {
  seedPlans()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error seeding plans:", err);
      process.exit(1);
    });
}
