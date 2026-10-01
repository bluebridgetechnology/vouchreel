"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { TimeSeriesPoint } from "./time-series-chart";
import { ConversionGoalsPanel, ConversionGoal } from "./conversion-goals-panel";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";

const TimeSeriesChart = dynamic(
  () => import("./time-series-chart").then((m) => m.TimeSeriesChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-control bg-muted" />
    ),
  }
);

export interface OverviewStats {
  impressions: number;
  plays: number;
  clicks: number;
  conversions: number;
}

export interface FunnelStep {
  step: string;
  count: number;
  dropOffPercent: number | null;
  conversionFromPrevious: number | null;
}

export interface PerTestimonialStats {
  testimonialId: string;
  title: string | null;
  customerName: string | null;
  thumbnailUrl: string | null;
  isActive: boolean | null;
  impressions: number;
  plays: number;
  clicks: number;
  conversions: number;
}

export interface ComparativeAnalyticsData {
  current: {
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  previous: {
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  deltas: {
    impressions: number;
    plays: number;
    clicks: number;
    conversions: number;
    playRate: number | null;
    conversionRate: number | null;
    funnel: Record<string, number>;
  };
}

export interface SegmentComparisonData {
  segment1: {
    filter: Record<string, unknown>;
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  segment2: {
    filter: Record<string, unknown>;
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  deltas: {
    impressions: number;
    plays: number;
    clicks: number;
    conversions: number;
    playRate: number | null;
    conversionRate: number | null;
    funnel: Record<string, number>;
  };
}

type SortKey =
  | "title"
  | "impressions"
  | "plays"
  | "clicks"
  | "conversions";

type CompareMode = "none" | "previous" | "segments";

const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

const STEP_LABELS: Record<string, string> = {
  impression: "Impressions",
  play: "Plays",
  click: "Clicks",
  convert: "Conversions",
};

function rangeFor(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export function AnalyticsDashboard({ spaceId }: { spaceId: string }) {
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Segmentation Filters
  const [selectedTestimonial, setSelectedTestimonial] = useState<string>("");
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [selectedTrafficSource, setSelectedTrafficSource] = useState<string>("");
  const [searchPageUrl, setSearchPageUrl] = useState<string>("");

  // Comparison Options
  const [compareMode, setCompareMode] = useState<CompareMode>("none");

  // Dynamic filter options discovered from events
  const [filterOptions, setFilterOptions] = useState<{
    devices: string[];
    trafficSources: string[];
    pageUrls: string[];
  }>({ devices: [], trafficSources: [], pageUrls: [] });

  // Data states
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [prevStats, setPrevStats] = useState<OverviewStats | null>(null);
  const [points, setPoints] = useState<TimeSeriesPoint[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [rows, setRows] = useState<PerTestimonialStats[]>([]);
  const [goals, setGoals] = useState<ConversionGoal[]>([]);

  // Detailed comparative state
  const [comparison, setComparison] = useState<ComparativeAnalyticsData | null>(null);
  const [segmentComparison, setSegmentComparison] = useState<SegmentComparisonData | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortAsc, setSortAsc] = useState(false);

  // Build query string helper
  const buildFilterQuery = (baseRange: { startDate: string; endDate: string }) => {
    const params = new URLSearchParams({
      startDate: baseRange.startDate,
      endDate: baseRange.endDate,
    });
    if (selectedTestimonial) params.set("testimonialId", selectedTestimonial);
    if (selectedDevice) params.set("deviceType", selectedDevice);
    if (selectedTrafficSource) params.set("trafficSource", selectedTrafficSource);
    if (searchPageUrl) params.set("pageUrl", searchPageUrl);
    return params.toString();
  };

  async function load(
    range: { startDate: string; endDate: string },
    prevRange: { startDate: string; endDate: string }
  ) {
    setLoading(true);
    setError(null);
    try {
      const filterQs = buildFilterQuery(range);
      const prevFilterQs = buildFilterQuery(prevRange);

      const fetches: Promise<Response>[] = [
        fetch(`/api/spaces/${spaceId}/analytics?type=overview&${filterQs}`),
        fetch(`/api/spaces/${spaceId}/analytics?type=overview&${prevFilterQs}`),
        fetch(`/api/spaces/${spaceId}/analytics?type=timeseries&${filterQs}`),
        fetch(`/api/spaces/${spaceId}/analytics?type=funnel&${filterQs}`),
        fetch(`/api/spaces/${spaceId}/analytics?type=testimonials&${filterQs}`),
        fetch(`/api/spaces/${spaceId}/conversion-goals`),
        fetch(`/api/spaces/${spaceId}/analytics?type=filter-options&${filterQs}`),
      ];

      if (compareMode === "previous") {
        fetches.push(
          fetch(
            `/api/spaces/${spaceId}/analytics?type=comparison&${filterQs}&prevStartDate=${prevRange.startDate}&prevEndDate=${prevRange.endDate}`
          )
        );
      } else if (compareMode === "segments") {
        fetches.push(
          fetch(
            `/api/spaces/${spaceId}/analytics?type=segment-comparison&${filterQs}&compareSegment=device`
          )
        );
      }

      const responses = await Promise.all(fetches);

      if (responses.some((r) => !r.ok)) {
        throw new Error("Failed to load analytics");
      }

      const overviewData = await responses[0].json();
      const prevData = await responses[1].json();
      const tsData = await responses[2].json();
      const funnelData = await responses[3].json();
      const tableData = await responses[4].json();
      const goalsData = await responses[5].json();
      const optionsData = await responses[6].json();

      setStats(overviewData.stats);
      setPrevStats(prevData.stats);
      setPoints(tsData.points);
      setFunnel(funnelData.funnel);
      setRows(tableData.testimonials);
      setGoals(goalsData.goals);
      if (optionsData.filterOptions) {
        setFilterOptions(optionsData.filterOptions);
      }

      if (compareMode === "previous" && responses[7]) {
        const compData = await responses[7].json();
        setComparison(compData.comparison);
        setSegmentComparison(null);
      } else if (compareMode === "segments" && responses[7]) {
        const segData = await responses[7].json();
        setSegmentComparison(segData.segmentComparison);
        setComparison(null);
      } else {
        setComparison(null);
        setSegmentComparison(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  function reloadData() {
    const range = rangeFor(days);
    const prevEnd = new Date();
    prevEnd.setDate(prevEnd.getDate() - days);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days);
    load(range, {
      startDate: prevStart.toISOString().slice(0, 10),
      endDate: prevEnd.toISOString().slice(0, 10),
    });
  }

  function handleRangeChange(nextDays: number) {
    setDays(nextDays);
  }

  useEffect(() => {
    reloadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    days,
    selectedTestimonial,
    selectedDevice,
    selectedTrafficSource,
    searchPageUrl,
    compareMode,
  ]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function handleResetFilters() {
    setSelectedTestimonial("");
    setSelectedDevice("");
    setSelectedTrafficSource("");
    setSearchPageUrl("");
    setCompareMode("none");
  }

  const hasActiveFilters =
    Boolean(selectedTestimonial) ||
    Boolean(selectedDevice) ||
    Boolean(selectedTrafficSource) ||
    Boolean(searchPageUrl);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === "title") {
        av = a.customerName || a.title || "";
        bv = b.customerName || b.title || "";
        if (typeof av === "string" && typeof bv === "string") {
          return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return 0;
      }
      av = a[sortKey];
      bv = b[sortKey];
      return sortAsc ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortAsc]);

  const hasNoEvents =
    !loading &&
    stats &&
    stats.impressions === 0 &&
    stats.plays === 0 &&
    stats.clicks === 0 &&
    stats.conversions === 0 &&
    points.length === 0;

  function trend(current: number | undefined, previous: number | undefined) {
    if (current === undefined || previous === undefined) return null;
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const pct = Math.round(((current - previous) / previous) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}%`;
  }

  const playRate =
    stats && stats.impressions > 0
      ? Math.round((stats.plays / stats.impressions) * 100)
      : null;
  const conversionRate =
    stats && stats.impressions > 0
      ? Math.round((stats.conversions / stats.impressions) * 100)
      : null;

  const maxFunnel = funnel.length > 0 ? Math.max(...funnel.map((f) => f.count), 1) : 1;

  const currentRange = rangeFor(days);
  const exportCsvUrl = `/api/spaces/${spaceId}/analytics/export?format=csv&${buildFilterQuery(
    currentRange
  )}`;
  const exportPdfUrl = `/api/spaces/${spaceId}/analytics/report?format=pdf&${buildFilterQuery(
    currentRange
  )}`;

  return (
    <div className="space-y-6">
      {/* Top action & date header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Track impressions, video plays, click-throughs, and conversions with multi-dimensional segmentation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date range picker buttons */}
          <div className="flex gap-1 rounded-control border p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleRangeChange(opt.days)}
                disabled={loading}
                className={`rounded-control px-2.5 py-1 text-xs font-medium transition-colors ${
                  days === opt.days
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Export buttons */}
          <a
            href={exportCsvUrl}
            download={`vouchreel-analytics-${spaceId}.csv`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            title="Export raw analytics data to CSV"
          >
            <svg
              className="h-3.5 w-3.5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export CSV
          </a>

          <a
            href={exportPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "primary", size: "sm" })}
            title="Download executive summary PDF report"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            Download PDF Report
          </a>
        </div>
      </div>

      {/* Filter and Comparison Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-2xs font-medium text-muted-foreground">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters:
          </span>

          {/* Testimonial Filter */}
          <select
            value={selectedTestimonial}
            onChange={(e) => setSelectedTestimonial(e.target.value)}
            className={cn(inputClass, "h-8 text-xs")}
          >
            <option value="">All Testimonials</option>
            {rows.map((row) => (
              <option key={row.testimonialId} value={row.testimonialId}>
                {row.customerName || row.title || "Untitled Testimonial"}
              </option>
            ))}
          </select>

          {/* Device Filter */}
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className={cn(inputClass, "h-8 text-xs")}
          >
            <option value="">All Devices</option>
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
          </select>

          {/* Traffic Source Filter */}
          <select
            value={selectedTrafficSource}
            onChange={(e) => setSelectedTrafficSource(e.target.value)}
            className={cn(inputClass, "h-8 text-xs")}
          >
            <option value="">All Traffic Sources</option>
            <option value="direct">Direct</option>
            {filterOptions.trafficSources
              .filter((src) => src !== "direct")
              .map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
          </select>

          {/* Page URL Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by Page URL..."
              value={searchPageUrl}
              onChange={(e) => setSearchPageUrl(e.target.value)}
              className={cn(inputClass, "h-8 w-44 text-xs")}
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="h-8 rounded-control border border-dashed px-2 text-2xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Compare Toggle */}
        <div className="flex items-center gap-1.5">
          <span className="text-2xs font-medium text-muted-foreground">Compare:</span>
          <div className="inline-flex rounded-control border p-0.5">
            <button
              onClick={() => setCompareMode("none")}
              className={`rounded-control px-2 py-0.5 text-xs font-medium transition-colors ${
                compareMode === "none"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Off
            </button>
            <button
              onClick={() => setCompareMode("previous")}
              className={`rounded-control px-2 py-0.5 text-xs font-medium transition-colors ${
                compareMode === "previous"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Previous Period
            </button>
            <button
              onClick={() => setCompareMode("segments")}
              className={`rounded-control px-2 py-0.5 text-xs font-medium transition-colors ${
                compareMode === "segments"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Mobile vs Desktop
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-control bg-destructive/10 p-4 text-xs text-destructive">{error}</div>
      )}

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-card border bg-muted/40" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-card border bg-muted/40" />
          <div className="h-48 animate-pulse rounded-card border bg-muted/40" />
        </>
      ) : hasNoEvents ? (
        <div className="rounded-card border border-dashed p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-muted">
            <svg
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-medium">No analytics data yet</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Once your widget is embedded and visitors start interacting, impressions,
            plays, and conversions matching your filters will show up here.
          </p>
        </div>
      ) : (
        <>
          {/* Comparison Mode Banner */}
          {compareMode === "previous" && (
            <div className="flex items-center justify-between rounded-control border border-primary/20 bg-primary/5 px-4 py-2 text-xs text-foreground">
              <span className="font-medium">
                Comparing Current Period (Last {days} days) vs Previous Period
              </span>
              <span className="text-2xs text-muted-foreground">
                Showing relative deltas and dual-period metrics
              </span>
            </div>
          )}

          {compareMode === "segments" && (
            <div className="flex items-center justify-between rounded-control border border-primary/20 bg-primary/5 px-4 py-2 text-xs text-foreground">
              <span className="font-medium">Comparing Mobile vs Desktop Segment Performance</span>
              <span className="text-2xs text-muted-foreground">
                Side-by-side device segmentation
              </span>
            </div>
          )}

          {/* Overview Cards: Normal or Comparative */}
          {compareMode === "segments" && segmentComparison ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <SegmentStatCard
                label="Impressions"
                val1={segmentComparison.segment1.stats.impressions}
                val2={segmentComparison.segment2.stats.impressions}
                delta={segmentComparison.deltas.impressions}
                name1="Mobile"
                name2="Desktop"
              />
              <SegmentStatCard
                label="Plays"
                val1={segmentComparison.segment1.stats.plays}
                val2={segmentComparison.segment2.stats.plays}
                delta={segmentComparison.deltas.plays}
                name1="Mobile"
                name2="Desktop"
              />
              <SegmentStatCard
                label="Clicks"
                val1={segmentComparison.segment1.stats.clicks}
                val2={segmentComparison.segment2.stats.clicks}
                delta={segmentComparison.deltas.clicks}
                name1="Mobile"
                name2="Desktop"
              />
              <SegmentStatCard
                label="Conversions"
                val1={segmentComparison.segment1.stats.conversions}
                val2={segmentComparison.segment2.stats.conversions}
                delta={segmentComparison.deltas.conversions}
                name1="Mobile"
                name2="Desktop"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Impressions"
                value={stats?.impressions ?? 0}
                prevValue={compareMode === "previous" ? prevStats?.impressions : undefined}
                trend={trend(stats?.impressions, prevStats?.impressions)}
              />
              <StatCard
                label="Plays"
                value={stats?.plays ?? 0}
                prevValue={compareMode === "previous" ? prevStats?.plays : undefined}
                sub={playRate !== null ? `${playRate}% play rate` : undefined}
                trend={trend(stats?.plays, prevStats?.plays)}
              />
              <StatCard
                label="Clicks"
                value={stats?.clicks ?? 0}
                prevValue={compareMode === "previous" ? prevStats?.clicks : undefined}
                trend={trend(stats?.clicks, prevStats?.clicks)}
              />
              <StatCard
                label="Conversions"
                value={stats?.conversions ?? 0}
                prevValue={compareMode === "previous" ? prevStats?.conversions : undefined}
                sub={conversionRate !== null ? `${conversionRate}% conversion rate` : undefined}
                trend={trend(stats?.conversions, prevStats?.conversions)}
              />
            </div>
          )}

          {/* Time-series chart */}
          <div className="rounded-card border bg-card p-4">
            <h3 className="mb-4 text-sm font-medium">Impressions & Plays Over Time</h3>
            {points.length === 0 ? (
              <p className="py-16 text-center text-xs text-muted-foreground">
                No events in this period matching the active filters.
              </p>
            ) : (
              <TimeSeriesChart points={points} />
            )}
          </div>

          {/* Funnel: Single or Comparative */}
          <div className="rounded-card border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium">Conversion Funnel</h3>
              {compareMode === "previous" && (
                <div className="flex items-center gap-3 text-2xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-control bg-primary" /> Current Period
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-control bg-muted-foreground/40" /> Previous Period
                  </span>
                </div>
              )}
              {compareMode === "segments" && (
                <div className="flex items-center gap-3 text-2xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-control bg-primary" /> Mobile
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-control bg-chart-3" /> Desktop
                  </span>
                </div>
              )}
            </div>

            {compareMode === "segments" && segmentComparison ? (
              <div className="space-y-4">
                {segmentComparison.segment1.funnel.map((step1, i) => {
                  const step2 = segmentComparison.segment2.funnel[i] || { count: 0, dropOffPercent: null };
                  const maxStep = Math.max(step1.count, step2.count, 1);
                  const delta = segmentComparison.deltas.funnel[step1.step] ?? 0;

                  return (
                    <div key={step1.step} className="rounded-card border bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">
                          {STEP_LABELS[step1.step] ?? step1.step}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-control px-1.5 py-0.5 text-2xs font-medium ${
                              delta >= 0
                                ? "bg-success-soft text-success-foreground"
                                : "bg-danger-soft text-danger-foreground"
                            }`}
                          >
                            {delta >= 0 ? "+" : ""}
                            {delta}% (Mobile vs Desktop)
                          </span>
                        </div>
                      </div>

                      {/* Mobile bar */}
                      <div className="mb-1.5">
                        <div className="mb-0.5 flex justify-between text-2xs text-muted-foreground">
                          <span>Mobile</span>
                          <span>{step1.count.toLocaleString()}</span>
                        </div>
                        <div className="h-4 w-full overflow-hidden rounded-control bg-muted">
                          <div
                            className="h-full rounded-control bg-primary transition-all"
                            style={{ width: `${Math.max((step1.count / maxStep) * 100, step1.count > 0 ? 5 : 0)}%` }}
                          />
                        </div>
                      </div>

                      {/* Desktop bar */}
                      <div>
                        <div className="mb-0.5 flex justify-between text-2xs text-muted-foreground">
                          <span>Desktop</span>
                          <span>{step2.count.toLocaleString()}</span>
                        </div>
                        <div className="h-4 w-full overflow-hidden rounded-control bg-muted">
                          <div
                            className="h-full rounded-control bg-chart-3 transition-all"
                            style={{ width: `${Math.max((step2.count / maxStep) * 100, step2.count > 0 ? 5 : 0)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {funnel.map((step, i) => {
                  const prevStepCount =
                    compareMode === "previous" && comparison
                      ? comparison.previous.funnel[i]?.count ?? 0
                      : null;

                  const delta =
                    compareMode === "previous" && comparison
                      ? comparison.deltas.funnel[step.step] ?? null
                      : null;

                  return (
                    <div key={step.step}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{STEP_LABELS[step.step] ?? step.step}</span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>{step.count.toLocaleString()}</span>
                          {prevStepCount !== null && (
                            <span className="text-2xs text-muted-foreground">
                              (Prev: {prevStepCount.toLocaleString()})
                            </span>
                          )}
                          {delta !== null && (
                            <span
                              className={`rounded-control px-1.5 py-0.2 text-2xs font-medium ${
                                delta >= 0
                                  ? "bg-success-soft text-success-foreground"
                                  : "bg-danger-soft text-danger-foreground"
                              }`}
                            >
                              {delta >= 0 ? "+" : ""}
                              {delta}%
                            </span>
                          )}
                          {step.conversionFromPrevious !== null && i > 0 && (
                            <span> · {step.conversionFromPrevious}% from prev</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="h-5 w-full overflow-hidden rounded-control bg-muted">
                          <div
                            className="flex h-full items-center justify-end rounded-control bg-primary pr-2 text-2xs font-medium text-primary-foreground transition-all"
                            style={{
                              width: `${Math.max(
                                (step.count / maxFunnel) * 100,
                                step.count > 0 ? 8 : 0
                              )}%`,
                            }}
                          />
                        </div>
                        {prevStepCount !== null && (
                          <div className="h-2 w-full overflow-hidden rounded-control bg-muted/60">
                            <div
                              className="h-full rounded-control bg-muted-foreground/40 transition-all"
                              style={{
                                width: `${Math.max(
                                  (prevStepCount / maxFunnel) * 100,
                                  prevStepCount > 0 ? 8 : 0
                                )}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {step.dropOffPercent !== null && i > 0 && (
                        <p className="mt-0.5 text-right text-2xs text-muted-foreground">
                          −{step.dropOffPercent}% drop-off
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Per-testimonial table */}
          <div className="rounded-card border bg-card p-4">
            <h3 className="mb-4 text-sm font-medium">Per-Testimonial Performance</h3>
            {rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No testimonials match the active filter.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      {(
                        [
                          ["title", "Testimonial"],
                          ["impressions", "Impressions"],
                          ["plays", "Plays"],
                          ["clicks", "Clicks"],
                          ["conversions", "Conversions"],
                        ] as Array<[SortKey, string]>
                      ).map(([key, label]) => (
                        <th key={key} className="px-2 py-2 font-medium">
                          <button
                            onClick={() => handleSort(key)}
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            {label}
                            {sortKey === key && <span>{sortAsc ? "▲" : "▼"}</span>}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.testimonialId} className="border-b last:border-0">
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2">
                            {row.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.thumbnailUrl}
                                alt=""
                                className="h-8 w-12 rounded-control object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-12 items-center justify-center rounded-control bg-muted text-muted-foreground">
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {row.customerName || row.title || "Untitled testimonial"}
                              </p>
                              {row.isActive === false && (
                                <p className="text-2xs text-muted-foreground">Inactive</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5">{row.impressions.toLocaleString()}</td>
                        <td className="px-2 py-2.5">
                          {row.plays.toLocaleString()}
                          {row.impressions > 0 && (
                            <span className="ml-1 text-2xs text-muted-foreground">
                              ({Math.round((row.plays / row.impressions) * 100)}%)
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5">{row.clicks.toLocaleString()}</td>
                        <td className="px-2 py-2.5">{row.conversions.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Conversion goals */}
          <ConversionGoalsPanel
            spaceId={spaceId}
            goals={goals}
            onGoalsChanged={setGoals}
          />
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  prevValue,
  sub,
  trend,
}: {
  label: string;
  value: number;
  prevValue?: number;
  sub?: string;
  trend: string | null;
}) {
  return (
    <div className="rounded-card border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-medium">{value.toLocaleString()}</p>
        {prevValue !== undefined && (
          <span className="text-xs text-muted-foreground">
            vs {prevValue.toLocaleString()}
          </span>
        )}
        {trend && (
          <span
            className={`text-2xs font-medium ${
              trend.startsWith("-") ? "text-danger-foreground" : "text-success-foreground"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      {sub && <p className="mt-0.5 text-2xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SegmentStatCard({
  label,
  val1,
  val2,
  delta,
  name1,
  name2,
}: {
  label: string;
  val1: number;
  val2: number;
  delta: number;
  name1: string;
  name2: string;
}) {
  return (
    <div className="rounded-card border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span
          className={`rounded-control px-1.5 py-0.5 text-2xs font-medium ${
            delta >= 0
              ? "bg-success-soft text-success-foreground"
              : "bg-danger-soft text-danger-foreground"
          }`}
        >
          {delta >= 0 ? "+" : ""}
          {delta}%
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-xs">
        <div>
          <p className="text-2xs text-muted-foreground">{name1}</p>
          <p className="text-base font-medium text-primary">{val1.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-2xs text-muted-foreground">{name2}</p>
          <p className="text-base font-medium text-chart-3">{val2.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
