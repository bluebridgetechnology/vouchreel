"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SpaceAgencyMetrics, AgencyOverviewResult } from "@/lib/agency/queries";
import { UpgradePromptModal } from "@/components/billing/upgrade-prompt-modal";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { toggleStyle } from "@/components/ui/toggle";
import { ModalOverlay } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";

interface AgencyViewProps {
  initialData: AgencyOverviewResult;
  isEntitled: boolean;
  canCreateMoreSpaces: boolean;
}

export function AgencyView({
  initialData,
  isEntitled,
  canCreateMoreSpaces,
}: AgencyViewProps) {
  const router = useRouter();
  const [data, setData] = useState<AgencyOverviewResult>(initialData);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "performance" | "conversions" | "plays">("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [loading, setLoading] = useState(false);

  // Upgrade prompt modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string>("agency-dashboard");

  // New Client Space Modal
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [clientName, setClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function fetchUpdated(
    newSearch: string,
    newSortBy: typeof sortBy,
    newSortOrder: typeof sortOrder
  ) {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sortBy: newSortBy,
        sortOrder: newSortOrder,
      });
      if (newSearch.trim()) params.set("search", newSearch.trim());

      const res = await fetch(`/api/agency/overview?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load overview");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearch(val);
    fetchUpdated(val, sortBy, sortOrder);
  }

  function handleSortChange(newSort: typeof sortBy) {
    let newOrder = sortOrder;
    if (newSort === sortBy) {
      newOrder = sortOrder === "asc" ? "desc" : "asc";
      setSortOrder(newOrder);
    } else {
      newOrder = newSort === "name" ? "asc" : "desc";
      setSortBy(newSort);
      setSortOrder(newOrder);
    }
    fetchUpdated(search, newSort, newOrder);
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (!canCreateMoreSpaces) {
      setShowAddClientModal(false);
      setUpgradeFeature("space-limit");
      setShowUpgradeModal(true);
      return;
    }

    if (!clientName.trim()) {
      setCreateError("Client name cannot be empty.");
      return;
    }

    try {
      setCreatingClient(true);
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clientName.trim() }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData?.error?.message || "Failed to create client space.");
      }

      setShowAddClientModal(false);
      setClientName("");
      // Redirect to the newly created space or refresh
      router.push(`/spaces/${resData.space.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Error creating space");
    } finally {
      setCreatingClient(false);
    }
  }

  const { summary, spaces } = data;

  return (
    <div className="space-y-8">
      {/* Non-entitled Banner */}
      {!isEntitled && (
        <div className="rounded-card border border-brand/20 bg-brand-soft p-5 text-text">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand mb-2">
                Agency Tier Preview
              </div>
              <h3 className="font-medium text-lg">Multi-Client Agency Cockpit</h3>
              <p className="text-sm text-text-muted mt-0.5">
                Aggregate analytics, client performance rankings, and 1-click executive PDF reporting across all managed client spaces.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUpgradeFeature("agency-dashboard");
                setShowUpgradeModal(true);
              }}
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "shrink-0")}
            >
              Upgrade to Agency Plan
            </button>
          </div>
        </div>
      )}

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card variant="flat" className="p-5 shadow-sm">
          <span className="text-xs font-medium text-text-muted">Managed Clients</span>
          <div className="mt-2 text-3xl font-medium tracking-tight text-text">
            {summary.totalSpaces}
          </div>
          <span className="text-xs text-text-muted mt-1 block">Active client spaces</span>
        </Card>

        <Card variant="flat" className="p-5 shadow-sm">
          <span className="text-xs font-medium text-text-muted">Total Impressions</span>
          <div className="mt-2 text-3xl font-medium tracking-tight text-text">
            {summary.totalImpressions.toLocaleString()}
          </div>
          <span className="text-xs text-text-muted mt-1 block">Across all client widgets</span>
        </Card>

        <Card variant="flat" className="p-5 shadow-sm">
          <span className="text-xs font-medium text-text-muted">Video Plays</span>
          <div className="mt-2 text-3xl font-medium tracking-tight text-text">
            {summary.totalPlays.toLocaleString()}
          </div>
          <span className="text-xs text-text-muted mt-1 block">Aggregated interactions</span>
        </Card>

        <Card variant="flat" className="p-5 shadow-sm">
          <span className="text-xs font-medium text-text-muted">Conversions</span>
          <div className="mt-2 text-3xl font-medium tracking-tight text-text text-success-foreground">
            {summary.totalConversions.toLocaleString()}
          </div>
          <span className="text-xs text-text-muted mt-1 block">Attributed outcomes</span>
        </Card>

        <Card variant="flat" className="p-5 shadow-sm col-span-2 lg:col-span-1">
          <span className="text-xs font-medium text-text-muted">Avg. Conversion Rate</span>
          <div className="mt-2 text-3xl font-medium tracking-tight text-text">
            {summary.overallConversionRate}%
          </div>
          <span className="text-xs text-text-muted mt-1 block">Global performance</span>
        </Card>
      </div>

      {/* Search, Filter & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search clients by name…"
            className={cn(inputClass, "pl-9 pr-4")}
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-3">
          <Card variant="flat" className="flex items-center gap-1.5 p-1 text-xs font-medium">
            <span className="px-2 text-text-muted">Sort:</span>
            <button
              type="button"
              onClick={() => handleSortChange("performance")}
              className={cn("rounded-control px-2.5 py-1 transition-colors", toggleStyle("solid", sortBy === "performance"))}
            >
              CR% {sortBy === "performance" && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
            <button
              type="button"
              onClick={() => handleSortChange("plays")}
              className={cn("rounded-control px-2.5 py-1 transition-colors", toggleStyle("solid", sortBy === "plays"))}
            >
              Plays {sortBy === "plays" && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
            <button
              type="button"
              onClick={() => handleSortChange("name")}
              className={cn("rounded-control px-2.5 py-1 transition-colors", toggleStyle("solid", sortBy === "name"))}
            >
              Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
          </Card>

          <button
            type="button"
            onClick={() => {
              if (!canCreateMoreSpaces) {
                setUpgradeFeature("space-limit");
                setShowUpgradeModal(true);
              } else {
                setShowAddClientModal(true);
              }
            }}
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          </button>
        </div>
      </div>

      {/* Client Spaces Grid / Table */}
      {spaces.length === 0 ? (
        <Card variant="flat" className="border-dashed p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-surface-sunken text-text-muted text-xl">
            🏢
          </div>
          <h3 className="text-lg font-medium">No Client Spaces Found</h3>
          <p className="text-sm text-text-muted max-w-sm mx-auto">
            {search
              ? `No client spaces matched "${search}". Try clearing your search.`
              : "Create your first client space to begin managing video proof and tracking conversions."}
          </p>
          <button
            type="button"
            onClick={() => setShowAddClientModal(true)}
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            Create Client Space
          </button>
        </Card>
      ) : (
        <Card variant="flat" className="divide-y overflow-hidden shadow-sm">
          {spaces.map((sp) => (
            <div
              key={sp.id}
              className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:bg-surface-sunken/20 transition-colors"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/spaces/${sp.id}`}
                    className="font-medium text-base hover:text-brand hover:underline truncate"
                  >
                    {sp.name}
                  </Link>
                  <span className="rounded-pill bg-surface-sunken px-2.5 py-0.5 text-xs text-text-muted">
                    {sp.testimonialCount} videos
                  </span>
                  {!sp.isDirectOwner && (
                    <span className="rounded-control bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-soft-foreground capitalize">
                      {sp.role}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted font-mono">
                  embedKey: {sp.embedKey}
                </div>
              </div>

              {/* Per-space metric spark badges */}
              <div className="grid grid-cols-4 gap-4 text-center shrink-0">
                <div className="px-3 py-1.5 rounded-control bg-surface-sunken/40">
                  <div className="text-xs text-text-muted font-medium">Views</div>
                  <div className="text-sm font-medium text-text mt-0.5">
                    {sp.impressions.toLocaleString()}
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-control bg-surface-sunken/40">
                  <div className="text-xs text-text-muted font-medium">Plays</div>
                  <div className="text-sm font-medium text-text mt-0.5">
                    {sp.plays.toLocaleString()}
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-control bg-surface-sunken/40">
                  <div className="text-xs text-text-muted font-medium">Conversions</div>
                  <div className="text-sm font-medium text-success-foreground mt-0.5">
                    {sp.conversions.toLocaleString()}
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-control bg-surface-sunken/40">
                  <div className="text-xs text-text-muted font-medium">CR %</div>
                  <div className="text-sm font-medium text-text mt-0.5">
                    {sp.conversionRate}%
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                <Link
                  href={`/spaces/${sp.id}/analytics`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Analytics
                </Link>
                <Link
                  href={`/spaces/${sp.id}/testimonials`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Videos
                </Link>
                <a
                  href={`/api/spaces/${sp.id}/analytics/report?format=pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-control bg-surface-sunken px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-sunken/80 transition-colors inline-flex items-center gap-1.5"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Report
                </a>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Add Client Space Modal */}
      {showAddClientModal && (
        <ModalOverlay label="Add new client space" onClose={() => setShowAddClientModal(false)}>
          <Card variant="flat" className="w-full max-w-md p-4 sm:p-6 shadow-float space-y-4">
            <h3 className="text-lg font-medium">Add New Client Space</h3>
            <p className="text-sm text-text-muted">
              Create a dedicated workspace container for your client&apos;s video testimonials and embed widget.
            </p>

            {createError && (
              <div className="rounded-control bg-danger-soft p-3 text-xs text-danger-foreground">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateClient} className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-medium text-text">Client or Business Name</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className={cn(inputClass, "mt-1 w-full text-sm")}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className={buttonVariants({ variant: "outline", size: "md" })}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={creatingClient}
                  loading={creatingClient}
                >
                  {creatingClient ? "Creating…" : "Create Space"}
                </Button>
              </div>
            </form>
          </Card>
        </ModalOverlay>
      )}

      {/* Upgrade Prompt Modal */}
      {showUpgradeModal && (
        <UpgradePromptModal
          feature={upgradeFeature}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}
