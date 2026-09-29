"use client";

import { useEffect, useMemo, useState } from "react";
import { TimeSeriesChart, TimeSeriesPoint } from "./time-series-chart";
import { ConversionGoalsPanel, ConversionGoal } from "./conversion-goals-panel";

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

type SortKey =
  | "title"
  | "impressions"
  | "plays"
  | "clicks"
  | "conversions";

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

  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [prevStats, setPrevStats] = useState<OverviewStats | null>(null);
  const [points, setPoints] = useState<TimeSeriesPoint[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [rows, setRows] = useState<PerTestimonialStats[]>([]);
  const [goals, setGoals] = useState<ConversionGoal[]>([]);

  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortAsc, setSortAsc] = useState(false);

  async function load(range: { startDate: string; endDate: string }, prevRange: { startDate: string; endDate: string }) {
    setLoading(true);
    setError(null);
    try {
      const qs = (r: { startDate: string; endDate: string }) =>
        `startDate=${r.startDate}&endDate=${r.endDate}`;
      const [overviewRes, prevRes, tsRes, funnelRes, tableRes, goalsRes] =
        await Promise.all([
          fetch(`/api/spaces/${spaceId}/analytics?type=overview&${qs(range)}`),
          fetch(`/api/spaces/${spaceId}/analytics?type=overview&${qs(prevRange)}`),
          fetch(`/api/spaces/${spaceId}/analytics?type=timeseries&${qs(range)}`),
          fetch(`/api/spaces/${spaceId}/analytics?type=funnel&${qs(range)}`),
          fetch(`/api/spaces/${spaceId}/analytics?type=testimonials&${qs(range)}`),
          fetch(`/api/spaces/${spaceId}/conversion-goals`),
        ]);

      if (!overviewRes.ok || !tsRes.ok || !funnelRes.ok || !tableRes.ok || !goalsRes.ok) {
        throw new Error("Failed to load analytics");
      }

      const overviewData = await overviewRes.json();
      const prevData = await prevRes.json();
      const tsData = await tsRes.json();
      const funnelData = await funnelRes.json();
      const tableData = await tableRes.json();
      const goalsData = await goalsRes.json();

      setStats(overviewData.stats);
      setPrevStats(prevRes.ok ? prevData.stats : null);
      setPoints(tsData.points);
      setFunnel(funnelData.funnel);
      setRows(tableData.testimonials);
      setGoals(goalsData.goals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  function handleRangeChange(nextDays: number) {
    setDays(nextDays);
    const range = rangeFor(nextDays);
    const prevEnd = new Date();
    prevEnd.setDate(prevEnd.getDate() - nextDays);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - nextDays);
    load(range, {
      startDate: prevStart.toISOString().slice(0, 10),
      endDate: prevEnd.toISOString().slice(0, 10),
    });
  }

  useEffect(() => {
    handleRangeChange(30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

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

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Track impressions, video plays, click-throughs, and conversions.
        </p>
        <div className="flex gap-1 rounded-md border p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => handleRangeChange(opt.days)}
              disabled={loading}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                days === opt.days
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-xs text-destructive">{error}</div>
      )}

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl border bg-muted/40" />
          <div className="h-48 animate-pulse rounded-xl border bg-muted/40" />
        </>
      ) : hasNoEvents ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-semibold">No analytics data yet</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Once your widget is embedded and visitors start interacting, impressions,
            plays, and conversions will show up here.
          </p>
        </div>
      ) : (
        <>
          {/* Overview cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Impressions"
              value={stats?.impressions ?? 0}
              trend={trend(stats?.impressions, prevStats?.impressions)}
            />
            <StatCard
              label="Plays"
              value={stats?.plays ?? 0}
              sub={playRate !== null ? `${playRate}% play rate` : undefined}
              trend={trend(stats?.plays, prevStats?.plays)}
            />
            <StatCard label="Clicks" value={stats?.clicks ?? 0} trend={trend(stats?.clicks, prevStats?.clicks)} />
            <StatCard
              label="Conversions"
              value={stats?.conversions ?? 0}
              sub={conversionRate !== null ? `${conversionRate}% conversion rate` : undefined}
              trend={trend(stats?.conversions, prevStats?.conversions)}
            />
          </div>

          {/* Time-series chart */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-4 text-sm font-semibold">Impressions & Plays Over Time</h3>
            {points.length === 0 ? (
              <p className="py-16 text-center text-xs text-muted-foreground">
                No events in this period.
              </p>
            ) : (
              <TimeSeriesChart points={points} />
            )}
          </div>

          {/* Funnel */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-4 text-sm font-semibold">Conversion Funnel</h3>
            <div className="space-y-2">
              {funnel.map((step, i) => (
                <div key={step.step}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{STEP_LABELS[step.step] ?? step.step}</span>
                    <span className="text-muted-foreground">
                      {step.count.toLocaleString()}
                      {step.conversionFromPrevious !== null && i > 0 && (
                        <> · {step.conversionFromPrevious}% from previous</>
                      )}
                    </span>
                  </div>
                  <div className="h-6 w-full overflow-hidden rounded-md bg-muted">
                    <div
                      className="flex h-full items-center justify-end rounded-md bg-primary pr-2 text-[10px] font-semibold text-primary-foreground transition-all"
                      style={{ width: `${Math.max((step.count / maxFunnel) * 100, step.count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  {step.dropOffPercent !== null && i > 0 && (
                    <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
                      −{step.dropOffPercent}% drop-off
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Per-testimonial table */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-4 text-sm font-semibold">Per-Testimonial Performance</h3>
            {rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No testimonials in this space yet.
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
                                className="h-8 w-12 rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-12 items-center justify-center rounded bg-muted text-muted-foreground">
                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {row.customerName || row.title || "Untitled testimonial"}
                              </p>
                              {row.isActive === false && (
                                <p className="text-[10px] text-muted-foreground">Inactive</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5">{row.impressions.toLocaleString()}</td>
                        <td className="px-2 py-2.5">
                          {row.plays.toLocaleString()}
                          {row.impressions > 0 && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
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
  sub,
  trend,
}: {
  label: string;
  value: number;
  sub?: string;
  trend: string | null;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        {trend && (
          <span
            className={`text-[10px] font-semibold ${
              trend.startsWith("-") ? "text-red-500" : "text-green-600"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
