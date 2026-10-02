import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { seedPlans } from "@/lib/db/seed-plans";
import { getSession } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Em } from "@/components/ui/em";
import { Container } from "@/components/ui/layout";
import { PricingTable, PlanItem } from "./pricing-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for Vouchreel. Collect and showcase video testimonials on any plan — start free, upgrade when you grow.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const session = await getSession();

  let dbPlans = await db.query.plans.findMany({
    where: eq(plans.isActive, true),
    orderBy: [asc(plans.sortOrder), asc(plans.price)],
  });

  // Automatically seed initial plans if table is empty
  if (dbPlans.length === 0) {
    try {
      dbPlans = await seedPlans();
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

  const plainPlans: PlanItem[] = dbPlans.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    interval: p.interval as "month" | "year",
    features: (p.features as string[]) || [],
    description: p.description,
    badge: p.badge,
    sortOrder: p.sortOrder,
    isActive: p.isActive,
  }));

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <Badge variant="eyebrow">Pricing</Badge>
        <h1 className="mt-6 text-5xl font-medium sm:text-display">
          Simple, <Em>transparent</Em> pricing
        </h1>
        <p className="mt-5 text-lg text-text-muted">
          Paste a video link and showcase genuine video testimonials on your website in seconds. Choose the plan that
          best fits your business.
        </p>
      </div>

      <PricingTable
        plans={plainPlans}
        user={session?.user ? { id: session.user.id, email: session.user.email } : null}
        currentPlanId={currentPlanId}
      />

      {/* FAQ / Guarantee */}
      <div className="mx-auto mt-24 max-w-2xl border-t pt-16 text-center">
        <h2 className="text-xl font-medium">Have questions or need a custom setup?</h2>
        <p className="mt-3 text-sm text-text-muted">
          Contact support at{" "}
          <a href="mailto:support@vouchreel.com" className="text-brand underline underline-offset-4">
            support@vouchreel.com
          </a>{" "}
          and we&apos;ll be happy to help. All paid plans come with a 14-day money-back guarantee.
        </p>
      </div>
    </Container>
  );
}
