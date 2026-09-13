import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { seedPlans } from "@/lib/db/seed-plans";
import { getSession } from "@/lib/auth/session";
import { PricingTable, PlanItem } from "./pricing-table";

export const dynamic = "force-dynamic";

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Header Navigation */}
      <header className="border-b bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">V</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">Vouchreel</span>
          </Link>
          <div className="flex items-center gap-4">
            {session?.user ? (
              <Link
                href="/"
                className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
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
        <div className="mt-24 border-t pt-16 text-center max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold">Have questions or need a custom setup?</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Contact support at{" "}
            <a href="mailto:support@vouchreel.com" className="text-primary underline">
              support@vouchreel.com
            </a>{" "}
            and we'll be happy to help. All paid plans come with a 14-day money-back guarantee.
          </p>
        </div>
      </main>
    </div>
  );
}
