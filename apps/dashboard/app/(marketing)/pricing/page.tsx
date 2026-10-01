import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { seedPlans } from "@/lib/db/seed-plans";
import { getSession } from "@/lib/auth/session";
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
    isActive: p.isActive,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-20">
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Paste a video link and showcase genuine video testimonials on your website in seconds.
          Choose the plan that best fits your business.
        </p>
      </div>

      <PricingTable
        plans={plainPlans}
        user={session?.user ? { id: session.user.id, email: session.user.email } : null}
        currentPlanId={currentPlanId}
      />

      {/* FAQ / Guarantee */}
      <div className="mx-auto mt-24 max-w-2xl border-t pt-16 text-center">
        <h3 className="text-lg font-semibold">Have questions or need a custom setup?</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          Contact support at{" "}
          <a href="mailto:support@vouchreel.com" className="text-primary underline">
            support@vouchreel.com
          </a>{" "}
          and we&apos;ll be happy to help. All paid plans come with a 14-day money-back guarantee.
        </p>
      </div>
    </div>
  );
}
