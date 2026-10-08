"use client";

import type { CompareMode, OverviewStats, SegmentComparisonData } from "./analytics-types";

export function StatCard({
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
    <div className="rounded-card border bg-surface p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-medium">{value.toLocaleString()}</p>
        {prevValue !== undefined && (
          <span className="text-xs text-text-muted">
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
      {sub && <p className="mt-0.5 text-2xs text-text-muted">{sub}</p>}
    </div>
  );
}

export function SegmentStatCard({
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
    <div className="rounded-card border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">{label}</p>
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
          <p className="text-2xs text-text-muted">{name1}</p>
          <p className="text-base font-medium text-brand">{val1.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-2xs text-text-muted">{name2}</p>
          <p className="text-base font-medium text-chart-3">{val2.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

interface OverviewCardsProps {
  compareMode: CompareMode;
  stats: OverviewStats | null;
  prevStats: OverviewStats | null;
  segmentComparison: SegmentComparisonData | null;
  playRate: number | null;
  conversionRate: number | null;
  trend: (current: number | undefined, previous: number | undefined) => string | null;
}

/** The four headline numbers: side by side for two segments, or one period (optionally against the previous). */
export function OverviewCards({ compareMode, stats, prevStats, segmentComparison, playRate, conversionRate, trend }: OverviewCardsProps) {
  return compareMode === "segments" && segmentComparison ? (
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
    );
}
