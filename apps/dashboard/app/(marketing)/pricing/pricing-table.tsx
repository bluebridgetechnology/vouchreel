"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PlanItem {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  features: string[] | null;
  isActive: boolean;
}

interface PricingTableProps {
  plans: PlanItem[];
  user: { id: string; email: string } | null;
  currentPlanId?: string | null;
}

export function PricingTable({
  plans,
  user,
  currentPlanId,
}: PricingTableProps) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  // Filter active plans by chosen interval
  const filteredPlans = plans.filter(
    (p) => p.isActive && (p.price === 0 || p.interval === interval)
  );

  // Group by unique plan tier name (Free, Pro, Business)
  const tierOrder = ["Free", "Pro", "Business"];
  const displayPlans = tierOrder
    .map((tierName) =>
      filteredPlans.find((p) => p.name.toLowerCase() === tierName.toLowerCase())
    )
    .filter(Boolean) as PlanItem[];

  async function handleSelectPlan(plan: PlanItem) {
    setErrorMessage(null);

    // If user is not logged in, send them to signup
    if (!user) {
      router.push(`/signup?planId=${plan.id}`);
      return;
    }

    // If user is already on this plan
    if (currentPlanId && currentPlanId === plan.id) {
      router.push("/settings/billing");
      return;
    }

    try {
      setLoadingPlanId(plan.id);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to initiate checkout");
      }

      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error initiating checkout";
      setErrorMessage(msg);
      setLoadingPlanId(null);
    }
  }

  return (
    <div className="w-full">
      {/* Interval Toggle */}
      <div className="flex justify-center mb-10">
        <div className="relative flex items-center rounded-full bg-muted p-1 border">
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              interval === "month"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly billing
          </button>
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-all ${
              interval === "year"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly billing
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Save ~17%
            </span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mx-auto mb-8 max-w-md rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid gap-8 lg:grid-cols-3 max-w-6xl mx-auto">
        {displayPlans.map((plan) => {
          const isPro = plan.name.toLowerCase() === "pro";
          const isCurrent = currentPlanId === plan.id;
          const isLoading = loadingPlanId === plan.id;

          const formattedPrice =
            plan.price === 0
              ? "$0"
              : `$${(plan.price / 100).toFixed(0)}`;

          const priceSubtext =
            plan.price === 0
              ? "forever free"
              : interval === "year"
              ? "/year"
              : "/month";

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-md ${
                isPro
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : "border-border"
              }`}
            >
              {isPro && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                  Most Popular
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  {isCurrent && (
                    <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      Current Plan
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.name === "Free"
                    ? "Perfect for side projects and evaluating Vouchreel."
                    : plan.name === "Pro"
                    ? "Everything you need to collect and showcase high-converting videos."
                    : "For fast-growing companies and agencies demanding maximum power."}
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight">
                    {formattedPrice}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {priceSubtext}
                  </span>
                </div>

                <ul className="mt-8 space-y-3.5 text-sm">
                  {(plan.features || []).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <svg
                        className="h-5 w-5 shrink-0 text-emerald-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-foreground/90">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t">
                <button
                  type="button"
                  disabled={isLoading || isCurrent}
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full rounded-lg py-2.5 px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isCurrent
                      ? "bg-muted text-muted-foreground"
                      : isPro
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {isLoading
                    ? "Redirecting..."
                    : isCurrent
                    ? "Current Plan"
                    : plan.price === 0
                    ? user
                      ? "Use Free Plan"
                      : "Get Started Free"
                    : `Subscribe to ${plan.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
