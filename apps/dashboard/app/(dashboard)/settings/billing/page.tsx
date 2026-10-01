import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getUserSubscription } from "@/lib/payments/subscription";
import { BillingManager } from "./billing-manager";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BillingSettingsPage() {
  const session = await requireSession();

  // Find user's active subscription and plan
  const subData = await getUserSubscription(session.user.id).catch((err) => {
    console.error("Failed to load user subscription/plan:", err);
    return null;
  });

  const userSub = subData?.subscription || null;
  const plan = subData?.plan || null;

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
          className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-sm")}
        >
          General
        </Link>
        <span className="text-sm font-medium text-brand border-b-2 border-brand pb-4 -mb-4">
          Billing & Subscription
        </span>
      </div>

      <div>
        <h1 className="text-3xl font-medium tracking-tight">Billing & Plans</h1>
        <p className="text-text-muted mt-1 text-sm">
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
