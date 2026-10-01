"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SpaceAgencyMetrics, AgencyOverviewResult } from "@/lib/agency/queries";
import { UpgradePromptModal } from "@/components/billing/upgrade-prompt-modal";

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
        <div className="rounded-card border border-primary/20 bg-primary/5 p-5 text-foreground">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-pill bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary mb-2">
                Agency Tier Preview
              </div>
              <h3 className="font-medium text-lg">Multi-Client Agency Cockpit</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Aggregate analytics, client performance rankings, and 1-click executive PDF reporting across all managed client spaces.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUpgradeFeature("agency-dashboard");
                setShowUpgradeModal(true);
              }}
              className="shrink-0 rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              Upgrade to Agency Plan
            </button>
          </div>
        </div>
      )}

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-card border bg-card p-5 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Managed Clients</span>
          <div className="mt-2 text-3xl font-medium tracking-tight text-foreground">
            {summary.totalSpaces}
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">Active client spaces</span>
        </div>

        <div className="rounded-card border bg-card p-5 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Total Impressions</span>
          <div className="mt-2 text-3xl font-medium tracking-tight text-foreground">
            {summary.totalImpressions.toLocaleString()}
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">Across all client widgets</span>
        </div>

        <div className="rounded-card border bg-card p-5 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Video Plays</span>
          <div className="mt-2 text-3xl font-medium tracking-tight text-foreground">
            {summary.totalPlays.toLocaleString()}
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">Aggregated interactions</span>
        </div>

        <div className="rounded-card border bg-card p-5 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Conversions</span>
          <div className="mt-2 text-3xl font-medium tracking-tight text-foreground text-success-foreground">
            {summary.totalConversions.toLocaleString()}
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">Attributed outcomes</span>
        </div>

        <div className="rounded-card border bg-card p-5 shadow-sm col-span-2 lg:col-span-1">
          <span className="text-xs font-medium text-muted-foreground">Avg. Conversion Rate</span>
          <div className="mt-2 text-3xl font-medium tracking-tight text-foreground">
            {summary.overallConversionRate}%
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">Global performance</span>
        </div>
      </div>

      {/* Search, Filter & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search clients by name…"
            className="w-full rounded-card border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-card border bg-card p-1 text-xs font-medium">
            <span className="px-2 text-muted-foreground">Sort:</span>
            <button
              type="button"
              onClick={() => handleSortChange("performance")}
              className={`rounded-control px-2.5 py-1 transition-colors ${
                sortBy === "performance" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent"
              }`}
            >
              CR% {sortBy === "performance" && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
            <button
              type="button"
              onClick={() => handleSortChange("plays")}
              className={`rounded-control px-2.5 py-1 transition-colors ${
                sortBy === "plays" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent"
              }`}
            >
              Plays {sortBy === "plays" && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
            <button
              type="button"
              onClick={() => handleSortChange("name")}
              className={`rounded-control px-2.5 py-1 transition-colors ${
                sortBy === "name" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent"
              }`}
            >
              Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
          </div>

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
            className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
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
        <div className="rounded-card border border-dashed bg-card p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-muted text-muted-foreground text-xl">
            🏢
          </div>
          <h3 className="text-lg font-medium">No Client Spaces Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {search
              ? `No client spaces matched "${search}". Try clearing your search.`
              : "Create your first client space to begin managing video proof and tracking conversions."}
          </p>
          <button
            type="button"
            onClick={() => setShowAddClientModal(true)}
            className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Create Client Space
          </button>
        </div>
      ) : (
        <div className="divide-y border rounded-card bg-card overflow-hidden shadow-sm">
          {spaces.map((sp) => (
            <div
              key={sp.id}
              className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:bg-muted/20 transition-colors"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/spaces/${sp.id}`}
                    className="font-medium text-base hover:text-primary hover:underline truncate"
                  >
                    {sp.name}
                  </Link>
                  <span className="rounded-pill bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {sp.testimonialCount} videos
                  </span>
                  {!sp.isDirectOwner && (
                    <span className="rounded-control bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground capitalize">
                      {sp.role}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  embedKey: {sp.embedKey}
                </div>
              </div>

              {/* Per-space metric spark badges */}
              <div className="grid grid-cols-4 gap-4 text-center shrink-0">
                <div className="px-3 py-1.5 rounded-control bg-muted/40">
                  <div className="text-xs text-muted-foreground font-medium">Views</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {sp.impressions.toLocaleString()}
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-control bg-muted/40">
                  <div className="text-xs text-muted-foreground font-medium">Plays</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {sp.plays.toLocaleString()}
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-control bg-muted/40">
                  <div className="text-xs text-muted-foreground font-medium">Conversions</div>
                  <div className="text-sm font-medium text-success-foreground mt-0.5">
                    {sp.conversions.toLocaleString()}
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-control bg-muted/40">
                  <div className="text-xs text-muted-foreground font-medium">CR %</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {sp.conversionRate}%
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                <Link
                  href={`/spaces/${sp.id}/analytics`}
                  className="rounded-control border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                >
                  Analytics
                </Link>
                <Link
                  href={`/spaces/${sp.id}/testimonials`}
                  className="rounded-control border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                >
                  Videos
                </Link>
                <a
                  href={`/api/spaces/${sp.id}/analytics/report?format=pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-control bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors inline-flex items-center gap-1.5"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Report
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Client Space Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 p-4">
          <div className="w-full max-w-md rounded-card border bg-card p-4 sm:p-6 shadow-float space-y-4">
            <h3 className="text-lg font-medium">Add New Client Space</h3>
            <p className="text-sm text-muted-foreground">
              Create a dedicated workspace container for your client&apos;s video testimonials and embed widget.
            </p>

            {createError && (
              <div className="rounded-control bg-destructive/10 p-3 text-xs text-destructive">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateClient} className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-medium text-foreground">Client or Business Name</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="mt-1 w-full rounded-control border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className="rounded-control border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingClient}
                  className="rounded-control bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creatingClient ? "Creating…" : "Create Space"}
                </button>
              </div>
            </form>
          </div>
        </div>
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
