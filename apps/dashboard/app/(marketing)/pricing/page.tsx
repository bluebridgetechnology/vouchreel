import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { queryActivePlans } from "@/lib/marketing/plans";
import { seedPlans } from "@/lib/db/seed-plans";
import { getSession } from "@/lib/auth/session";
import { FinalCta } from "@/components/marketing/final-cta";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Em } from "@/components/ui/em";
import { Container } from "@/components/ui/layout";
import { PricingTable } from "./pricing-table";

export const dynamic = "force-dynamic";

/** Billing questions, answered from how the product works today. */
const PRICING_FAQS: FaqItem[] = [
  {
    q: "Can I try Vouchreel before paying?",
    a: "Yes. The free plan needs no credit card, so you can collect and embed your first testimonials with the real product and decide after.",
  },
  {
    q: "What is the difference between monthly and yearly billing?",
    a: "Yearly is paid once a year and works out cheaper, about two months free. Monthly is paid every month. Switch the toggle above the plans to compare the prices.",
  },
  {
    q: "How do I pay?",
    a: "Checkout is handled by our payment provider, so your card details go to them and never touch Vouchreel. You choose the plan, pay, and it is active straight away.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, from your billing settings at any time. There is no long-term contract.",
  },
  {
    q: "Which plan should I start with?",
    a: "Start with Free to see how it looks on your site. Move up when you reach the free plan's limits or want to remove the Vouchreel watermark; each plan's card lists what it adds.",
  },
  {
    q: "Do you have a plan for bigger teams or agencies?",
    a: "Write to us at support@vouchreel.com with what you need and we will help you find the right fit.",
  },
];

export const metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for Vouchreel. Collect and showcase video testimonials on any plan — start free, upgrade when you grow.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const session = await getSession();

  let plainPlans = await queryActivePlans();

  // Automatically seed initial plans if table is empty
  if (plainPlans.length === 0) {
    try {
      await seedPlans();
      plainPlans = await queryActivePlans();
    } catch (e) {
      console.error("Failed to auto-seed plans on pricing page:", e);
    }
  }

  let currentPlanId: string | null = null;
  if (session?.user?.id) {
    const userSub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, session.user.id),
    });
    currentPlanId = userSub?.planId || null;
  }

  return (
    <>
      <Container className="pb-8 pt-16 sm:pt-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 text-center">
          <Badge variant="eyebrow">Pricing</Badge>
          <h1 className="text-5xl font-medium sm:text-7xl">
            Simple, <Em>transparent</Em> pricing
          </h1>
          <p className="max-w-2xl text-lg text-text-muted">
            Start free and upgrade when your testimonials start paying for themselves. Every plan collects video testimonials and shows
            them on your site.
          </p>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-text-muted">
            {["No credit card to start", "Cancel anytime", "No long-term contracts"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Icon name="check-circle" size="sm" className="text-brand" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <Container className="pb-8 pt-8 sm:pb-16">
        <PricingTable
          layout="compact"
          plans={plainPlans}
          user={session?.user ? { id: session.user.id, email: session.user.email } : null}
          currentPlanId={currentPlanId}
        />
      </Container>

      <Faq
        id="pricing-faq"
        eyebrow="Billing"
        title={
          <>
            Questions about <Em>pricing</Em>
          </>
        }
        intro="How plans, billing and payment work. For anything else, write to us."
        items={PRICING_FAQS}
      />

      <FinalCta />
    </>
  );
}
