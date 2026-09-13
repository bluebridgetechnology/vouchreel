import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { BillingManager } from "./billing-manager";

export const dynamic = "force-dynamic";

export default async function BillingSettingsPage() {
  const session = await requireSession();

  // Find user's active subscription
  const userSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
  });

  let plan = null;
  if (userSub?.planId) {
    plan = await db.query.plans.findFirst({
      where: eq(plans.id, userSub.planId),
    });
  }

  // If no plan, fallback to Free
  const planName = plan?.name || "Free";
  const price = plan?.price ?? 0;
  const interval = plan?.interval || "month";
  const status = userSub?.status || "active";
  const provider = userSub?.provider || null;
  const hasProviderCustomer = Boolean(userSub?.providerCustomerId);
  const currentPeriodEnd = userSub?.currentPeriodEnd
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(userSub.currentPeriodEnd))
    : null;

  const features = (plan?.features as string[]) || [
    "1 space",
    "Up to 3 testimonials",
    "Standard floating widget",
    "Community support",
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Settings Navigation Subheader */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Link
          href="/settings"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          General
        </Link>
        <span className="text-sm font-medium text-primary border-b-2 border-primary pb-4 -mb-4">
          Billing & Subscription
        </span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Plans</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Review your current plan tier, manage payment methods, or upgrade for higher limits.
        </p>
      </div>

      <BillingManager
        planName={planName}
        price={price}
        interval={interval}
        status={status}
        currentPeriodEnd={currentPeriodEnd}
        hasProviderCustomer={hasProviderCustomer}
        provider={provider}
        features={features}
      />
    </div>
  );
}
