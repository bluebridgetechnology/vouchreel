"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { TimeSeriesPoint } from "./time-series-chart";
import { ConversionGoalsPanel, ConversionGoal } from "./conversion-goals-panel";
import {
  rangeFor,
  type ComparativeAnalyticsData,
  type CompareMode,
  type FunnelStep,
  type OverviewStats,
  type PerTestimonialStats,
  type SegmentComparisonData,
  type SortKey,
} from "./analytics-types";
import { AnalyticsToolbar } from "./analytics-toolbar";
import { AnalyticsFunnel } from "./analytics-funnel";
import { AnalyticsTable } from "./analytics-table";
import { OverviewCards } from "./stat-cards";
import { Card } from "@/components/ui/card";

export type { ComparativeAnalyticsData, FunnelStep, OverviewStats, PerTestimonialStats, SegmentComparisonData } from "./analytics-types";

const TimeSeriesChart = dynamic(
  () => import("./time-series-chart").then((m) => m.TimeSeriesChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-control bg-surface-sunken" />
    ),
  }
);


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
      <AnalyticsToolbar
        spaceId={spaceId}
        days={days}
        loading={loading}
        exportCsvUrl={exportCsvUrl}
        exportPdfUrl={exportPdfUrl}
        rows={rows}
        trafficSources={filterOptions.trafficSources}
        selectedTestimonial={selectedTestimonial}
        selectedDevice={selectedDevice}
        selectedTrafficSource={selectedTrafficSource}
        searchPageUrl={searchPageUrl}
        hasActiveFilters={hasActiveFilters}
        compareMode={compareMode}
        onRangeChange={handleRangeChange}
        setSelectedTestimonial={setSelectedTestimonial}
        setSelectedDevice={setSelectedDevice}
        setSelectedTrafficSource={setSelectedTrafficSource}
        setSearchPageUrl={setSearchPageUrl}
        setCompareMode={setCompareMode}
        onResetFilters={handleResetFilters}
      />

      {error && (
        <div className="rounded-control bg-danger-soft p-4 text-xs text-danger-foreground">{error}</div>
      )}

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-card border bg-surface-sunken/40" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-card border bg-surface-sunken/40" />
          <div className="h-48 animate-pulse rounded-card border bg-surface-sunken/40" />
        </>
      ) : hasNoEvents ? (
        <div className="rounded-card border border-dashed p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-surface-sunken">
            <svg
              className="h-6 w-6 text-text-muted"
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
          <p className="mt-1 max-w-sm text-xs text-text-muted">
            Once your widget is embedded and visitors start interacting, impressions,
            plays, and conversions matching your filters will show up here.
          </p>
        </div>
      ) : (
        <>
          {/* Comparison Mode Banner */}
          {compareMode === "previous" && (
            <div className="flex items-center justify-between rounded-control border border-brand/20 bg-brand-soft px-4 py-2 text-xs text-text">
              <span className="font-medium">
                Comparing Current Period (Last {days} days) vs Previous Period
              </span>
              <span className="text-2xs text-text-muted">
                Showing relative deltas and dual-period metrics
              </span>
            </div>
          )}

          {compareMode === "segments" && (
            <div className="flex items-center justify-between rounded-control border border-brand/20 bg-brand-soft px-4 py-2 text-xs text-text">
              <span className="font-medium">Comparing Mobile vs Desktop Segment Performance</span>
              <span className="text-2xs text-text-muted">
                Side-by-side device segmentation
              </span>
            </div>
          )}

          <OverviewCards
            compareMode={compareMode}
            stats={stats}
            prevStats={prevStats}
            segmentComparison={segmentComparison}
            playRate={playRate}
            conversionRate={conversionRate}
            trend={trend}
          />

          {/* Time-series chart */}
          <Card variant="flat" className="p-4">
            <h3 className="mb-4 text-sm font-medium">Impressions & Plays Over Time</h3>
            {points.length === 0 ? (
              <p className="py-16 text-center text-xs text-text-muted">
                No events in this period matching the active filters.
              </p>
            ) : (
              <TimeSeriesChart points={points} />
            )}
          </Card>

          <AnalyticsFunnel
            compareMode={compareMode}
            funnel={funnel}
            maxFunnel={maxFunnel}
            comparison={comparison}
            segmentComparison={segmentComparison}
          />

          <AnalyticsTable rows={rows} sortedRows={sortedRows} sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />

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
