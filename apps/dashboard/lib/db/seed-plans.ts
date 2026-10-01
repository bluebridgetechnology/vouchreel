import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { plans } from "./schema";

export const DEFAULT_PLANS = [
  {
    name: "Free",
    price: 0,
    interval: "month" as const,
    features: [
      "1 space",
      "Up to 3 testimonials",
      "Standard floating widget",
      "Vouchreel branding",
      "Community support",
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
      "Unlimited spaces",
      "Unlimited video testimonials",
      "All widget positions & trigger rules",
      "Custom branding & theme customization",
      "Click & view analytics",
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
      "Unlimited spaces",
      "Unlimited video testimonials",
      "All widget positions & trigger rules",
      "Custom branding & theme customization",
      "Click & view analytics",
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
    name: "Business",
    price: 4900, // $49.00
    interval: "month" as const,
    features: [
      "Everything in Pro",
      "Advanced page-targeting match rules",
      "Custom CSS styling",
      "Priority email & chat support",
      "Early access to Phase 2 AI clipping",
    ],
    stripeProductId: "prod_biz_monthly",
    stripePriceId: "price_biz_monthly",
    dodoProductId: "pdt_biz_monthly",
    dodoPriceId: "price_biz_monthly",
    isActive: true,
  },
  {
    name: "Business",
    price: 49000, // $490.00 (2 months free)
    interval: "year" as const,
    features: [
      "Everything in Pro",
      "Advanced page-targeting match rules",
      "Custom CSS styling",
      "Priority email & chat support",
      "Early access to Phase 2 AI clipping",
      "2 months free included",
    ],
    stripeProductId: "prod_biz_yearly",
    stripePriceId: "price_biz_yearly",
    dodoProductId: "pdt_biz_yearly",
    dodoPriceId: "price_biz_yearly",
    isActive: true,
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
      const [inserted] = await db.insert(plans).values(plan).returning();
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
