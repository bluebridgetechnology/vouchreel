"use client";

import { useCallback, useEffect, useState } from "react";
import { change, dayKey, playRate, type WidgetPerformance } from "@/lib/widgets/performance";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export type Data = WidgetPerformance & { publishedAt: string | null; isLive: boolean };

const number = (n: number) => n.toLocaleString("en");

/** "up 12%" / "down 8%" against the 30 days before, or nothing when there is nothing to compare with. */
function Trend({ now, before }: { now: number; before: number }) {
  const pct = change(now, before);
  if (pct === null || pct === 0) return null;
  return (
    <span className={cn("text-2xs tabular-nums", pct > 0 ? "text-success-foreground" : "text-text-muted")}>
      {pct > 0 ? "up" : "down"} {Math.abs(pct)}%
    </span>
  );
}

function Stat({ label, value, trend }: { label: string; value: string; trend?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs text-text-muted">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        <span className="text-lg font-medium tabular-nums text-text">{value}</span>
        {trend}
      </dd>
    </div>
  );
}

/** Daily views as bars, with the plays inside them, and a mark on the day the widget was last published. */
function Bars({ data }: { data: Data }) {
  const max = Math.max(1, ...data.series.map((d) => d.views));
  const published = data.publishedAt ? dayKey(new Date(data.publishedAt)) : null;
  const w = 100 / data.series.length;
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-16 w-full" role="img" aria-label={`Views and plays each day for the last ${data.days} days. ${number(data.views)} views, ${number(data.plays)} plays in total.`}>
      {data.series.map((d, i) => {
        const h = (d.views / max) * 30;
        const ph = (Math.min(d.plays, d.views) / max) * 30;
        return (
          <g key={d.date}>
            <title>{`${d.date}: ${d.views} views, ${d.plays} plays`}</title>
            <rect x={i * w + w * 0.15} y={32 - Math.max(h, d.views > 0 ? 1 : 0.4)} width={w * 0.7} height={Math.max(h, d.views > 0 ? 1 : 0.4)} className={d.views > 0 ? "fill-brand/30" : "fill-border"} />
            {ph > 0 && <rect x={i * w + w * 0.15} y={32 - ph} width={w * 0.7} height={ph} className="fill-brand" />}
            {d.date === published && <rect x={i * w} y={0} width={0.6} height={32} className="fill-text-muted" />}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * How the widget is doing, in the editor, so a change can be judged without leaving it: the last 30 days of
 * views, plays and clicks against the 30 before, and a bar for each day with a mark where it was last published.
 */
export function PerformancePanel({ spaceId, widgetId }: { spaceId: string; widgetId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/widgets/${widgetId}/performance`);
      if (!res.ok) throw new Error();
      setData((await res.json()) as Data);
    } catch {
      setFailed(true);
    }
  }, [spaceId, widgetId]);

  useEffect(() => {
    load();
  }, [load]);

  const rate = data ? playRate(data.views, data.plays) : null;
  const summary = failed
    ? "Could not load"
    : !data
      ? "Loading"
      : !data.isLive && !data.publishedAt
        ? "Not live yet"
        : data.views === 0
          ? "No views in the last 30 days"
          : `${number(data.views)} views${rate === null ? "" : `, ${rate}% played`} in 30 days`;

  return (
    <details className="group rounded-card border bg-surface">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <Icon name="chart" size="sm" className="shrink-0 text-text-subtle" />
          <span className="font-medium text-text">How it is doing</span>
          <span className="truncate text-xs text-text-muted" aria-live="polite">
            {summary}
          </span>
        </span>
        <Icon name="alt-arrow-down" size="sm" className="shrink-0 text-text-subtle transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-3 border-t px-4 py-4">
        {failed ? (
          <p role="alert" className="text-xs text-danger-foreground">
            We could not load the numbers.{" "}
            <button type="button" onClick={load} className="underline underline-offset-4">
              Try again
            </button>
          </p>
        ) : !data ? (
          <div className="h-24 animate-pulse rounded-card bg-surface-sunken" aria-label="Loading the numbers" />
        ) : !data.isLive && !data.publishedAt ? (
          <p className="text-xs text-text-muted">Numbers appear here once the widget is live and visitors have seen it.</p>
        ) : (
          <PerformanceBody data={data} />
        )}
      </div>
    </details>
  );
}

/** The numbers and the daily bars, for a widget that has been live. */
export function PerformanceBody({ data, now = Date.now() }: { data: Data; now?: number }) {
  const rate = playRate(data.views, data.plays);
  const publishedInWindow = data.publishedAt && data.series.some((d) => d.date === dayKey(new Date(data.publishedAt!)));
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Stat label="Views" value={number(data.views)} trend={<Trend now={data.views} before={data.previous.views} />} />
        <Stat label="Plays" value={number(data.plays)} trend={<Trend now={data.plays} before={data.previous.plays} />} />
        <Stat label="Played" value={rate === null ? "-" : `${rate}%`} />
        <Stat label="Clicks" value={number(data.clicks)} trend={<Trend now={data.clicks} before={data.previous.clicks} />} />
      </dl>
      {data.views > 0 ? (
        <>
          <Bars data={data} />
          <p className="text-2xs text-text-muted">
            Last {data.days} days, compared with the {data.days} before. Dark bars are plays.
            {publishedInWindow ? ` The line marks when you last published (${timeAgo(data.publishedAt!, now)}).` : ""}
          </p>
        </>
      ) : (
        <p className="text-xs text-text-muted">Nobody has seen this widget yet in the last {data.days} days. Check the Install step to see whether your site is sending views.</p>
      )}
    </>
  );
}
