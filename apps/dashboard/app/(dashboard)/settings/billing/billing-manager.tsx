"use client";

import { useState } from "react";
import Link from "next/link";

interface BillingManagerProps {
  planName: string;
  price: number;
  interval: string;
  status: string;
  currentPeriodEnd: string | null;
  hasProviderCustomer: boolean;
  provider: string | null;
  features: string[];
}

export function BillingManager({
  planName,
  price,
  interval,
  status,
  currentPeriodEnd,
  hasProviderCustomer,
  provider,
  features,
}: BillingManagerProps) {
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  async function handleOpenPortal() {
    setPortalError(null);
    setLoadingPortal(true);

    try {
      const res = await fetch("/api/customer-portal", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data?.error?.message || "Failed to open billing portal");
      }

      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error opening customer portal";
      setPortalError(msg);
      setLoadingPortal(false);
    }
  }

  const isFree = price === 0;

  const statusColors: Record<string, string> = {
    active: "bg-success-soft text-success-foreground",
    trialing: "bg-info-soft text-info-foreground",
    past_due: "bg-warning-soft text-warning-foreground",
    canceled: "bg-danger-soft text-danger-foreground",
    incomplete: "bg-surface-sunken text-text",
  };

  const badgeColor = statusColors[status] || statusColors.active;

  return (
    <div className="space-y-6">
      {portalError && (
        <div className="rounded-card border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {portalError}
        </div>
      )}

      {/* Subscription Card */}
      <div className="rounded-card border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-medium">{planName} Plan</h2>
              <span
                className={`rounded-pill px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider ${badgeColor}`}
              >
                {status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFree
                ? "Free tier with basic widget capability."
                : `$${(price / 100).toFixed(0)} billed per ${interval}. Powered by ${
                    provider === "dodo" ? "Dodo Payments" : "Stripe"
                  }.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {hasProviderCustomer && (
              <button
                type="button"
                disabled={loadingPortal}
                onClick={handleOpenPortal}
                className="rounded-control border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
              >
                {loadingPortal ? "Opening portal..." : "Manage Subscription"}
              </button>
            )}

            <Link
              href="/pricing"
              className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Change Plan
            </Link>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
          <div>
            <h4 className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
              Billing Details
            </h4>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">
                  {isFree ? "Free ($0)" : `$${(price / 100).toFixed(2)}/${interval}`}
                </span>
              </div>
              {currentPeriodEnd && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Renews on:</span>
                  <span className="font-medium">{currentPeriodEnd}</span>
                </div>
              )}
              {provider && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-medium capitalize">{provider}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
              Included Features
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              {features.map((feat, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-success shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
