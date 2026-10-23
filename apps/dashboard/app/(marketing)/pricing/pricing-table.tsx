"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowButton } from "@/components/marketing/arrow-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface PlanItem {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  features: string[] | null;
  description?: string | null;
  badge?: string | null;
  sortOrder?: number;
  isActive: boolean;
}

/** The card background of each plan in turn: the app's soft tints, so they follow light and dark mode. */
const TINTS = ["pink", "lime", "peach", "cream"] as const;

interface PricingTableProps {
  plans: PlanItem[];
  user: { id: string; email: string } | null;
  currentPlanId?: string | null;
}

export function PricingTable({ plans, user, currentPlanId }: PricingTableProps) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  // One card per plan name, in admin-defined order. Free ($0) plans show on both intervals;
  // paid plans show the variant that matches the selected billing interval.
  const byName = new Map<string, PlanItem>();
  for (const p of plans) {
    if (!p.isActive) continue;
    if (p.price !== 0 && p.interval !== interval) continue;
    const key = p.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, p);
  }
  const displayPlans = [...byName.values()].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.price - b.price
  );

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

      {/* Plans: wide cards two to a row, an odd one out sits in the middle */}
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-6">
        {displayPlans.map((plan, index) => {
          const isCurrent = currentPlanId === plan.id;
          const isLoading = loadingPlanId === plan.id;

          const formattedPrice = plan.price === 0 ? "$0" : `$${(plan.price / 100).toFixed(0)}`;
          const priceSubtext = plan.price === 0 ? "forever free" : interval === "year" ? "/year" : "/month";
          const label =
            isLoading ? "Redirecting…" : plan.price === 0 ? (user ? "Use free plan" : "Get started free") : `Subscribe to ${plan.name}`;

          return (
            <Card
              key={plan.id}
              variant={TINTS[index % TINTS.length]}
              className="flex w-full flex-col gap-6 p-8 sm:flex-row sm:gap-10 sm:p-10 lg:w-[calc(50%-0.75rem)]"
            >
              <div className="flex flex-col items-start justify-between gap-6 sm:self-stretch">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="h-7 bg-surface-inverse px-3 text-sm font-normal text-text-inverse">{plan.name}</Badge>
                    {plan.badge && <Badge variant="brand">{plan.badge}</Badge>}
                    {isCurrent && <Badge variant="brand">Current plan</Badge>}
                  </div>
                  <p className="max-w-56 text-sm opacity-70">{plan.description}</p>
                </div>

                <div className="flex flex-col gap-4">
                  <p className="flex items-end gap-1">
                    <span className="text-4xl font-medium tracking-tight tabular-nums sm:text-5xl">{formattedPrice}</span>
                    <span className="pb-1 text-base opacity-70">{priceSubtext}</span>
                  </p>
                  {isCurrent ? (
                    <Button type="button" size="lg" variant="soft" className="w-fit" disabled>
                      Current plan
                    </Button>
                  ) : (
                    <ArrowButton size="lg" disabled={isLoading} onClick={() => handleSelectPlan(plan)}>
                      {label}
                    </ArrowButton>
                  )}
                </div>
              </div>

              <div aria-hidden="true" className="hidden w-px self-stretch bg-current opacity-10 sm:block" />
              <div aria-hidden="true" className="h-px w-full bg-current opacity-10 sm:hidden" />

              <div className="flex grow flex-col items-start gap-3">
                <p className="text-base font-medium sm:text-xl">Features</p>
                <ul className="flex flex-col items-start gap-3 self-stretch">
                  {(plan.features || []).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      <Icon name="check-circle" size="sm" className="mt-0.5 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
