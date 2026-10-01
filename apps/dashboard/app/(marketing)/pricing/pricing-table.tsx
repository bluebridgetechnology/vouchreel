"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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

const descriptions: Record<string, string> = {
  free: "Perfect for side projects and evaluating Vouchreel.",
  pro: "Everything you need to collect and showcase high-converting videos.",
  agency: "For agencies and teams managing multiple client brands with white-label proof.",
};
const fallbackDescription = "For fast-growing companies and agencies demanding maximum power.";

export function PricingTable({ plans, user, currentPlanId }: PricingTableProps) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  // Filter active plans by chosen interval
  const filteredPlans = plans.filter((p) => p.isActive && (p.price === 0 || p.interval === interval));

  // Group by unique plan tier name (Free, Pro, Agency / Business)
  const tierOrder = ["Free", "Pro", "Agency", "Business"];
  const displayPlans = tierOrder
    .map((tierName) => filteredPlans.find((p) => p.name.toLowerCase() === tierName.toLowerCase()))
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
        throw new Error(data?.error?.message || "Failed to initiate checkout");
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
      {/* Interval toggle */}
      <div className="mb-12 flex justify-center">
        <Tabs value={interval} onValueChange={(v) => setInterval(v as "month" | "year")}>
          <TabsList>
            <TabsTrigger value="month" className="h-9 px-5">
              Monthly billing
            </TabsTrigger>
            <TabsTrigger value="year" className="h-9 px-5">
              Yearly billing
              <Badge variant="success" className="px-2 py-0 text-2xs">
                Save ~17%
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mx-auto mb-8 max-w-md rounded-card bg-danger-soft p-4 text-center text-sm text-danger-foreground"
        >
          {errorMessage}
        </div>
      )}

      {/* Cards grid */}
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
        {displayPlans.map((plan) => {
          const isPro = plan.name.toLowerCase() === "pro";
          const isCurrent = currentPlanId === plan.id;
          const isLoading = loadingPlanId === plan.id;

          const formattedPrice = plan.price === 0 ? "$0" : `$${(plan.price / 100).toFixed(0)}`;
          const priceSubtext = plan.price === 0 ? "forever free" : interval === "year" ? "/year" : "/month";

          return (
            <Card
              key={plan.id}
              variant={isPro ? "inverse" : "default"}
              padding="lg"
              className={cn("relative flex flex-col justify-between", isPro && "shadow-float")}
            >
              {isPro && (
                <Badge variant="brand" className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-text-on-accent">
                  Most popular
                </Badge>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-medium">{plan.name}</h2>
                  {isCurrent && <Badge variant="brand">Current plan</Badge>}
                </div>

                <p className={cn("mt-2 text-sm", isPro ? "opacity-70" : "text-text-muted")}>
                  {descriptions[plan.name.toLowerCase()] ?? fallbackDescription}
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-medium tracking-tight tabular-nums">{formattedPrice}</span>
                  <span className={cn("text-sm", isPro ? "opacity-70" : "text-text-muted")}>{priceSubtext}</span>
                </div>

                <ul className="mt-8 space-y-3.5 text-sm">
                  {(plan.features || []).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Icon name="check-circle" size="sm" className={cn("mt-0.5", isPro ? "text-brand" : "text-success")} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 border-t border-current/10 pt-6">
                <Button
                  type="button"
                  size="lg"
                  variant={isCurrent ? "soft" : isPro ? "primary" : "outline"}
                  className="w-full"
                  loading={isLoading}
                  disabled={isCurrent}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {isLoading
                    ? "Redirecting…"
                    : isCurrent
                      ? "Current plan"
                      : plan.price === 0
                        ? user
                          ? "Use free plan"
                          : "Get started free"
                        : `Subscribe to ${plan.name}`}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
