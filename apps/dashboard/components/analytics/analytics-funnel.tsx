"use client";

import { STEP_LABELS, type CompareMode, type ComparativeAnalyticsData, type FunnelStep, type SegmentComparisonData } from "./analytics-types";

interface AnalyticsFunnelProps {
  compareMode: CompareMode;
  funnel: FunnelStep[];
  maxFunnel: number;
  comparison: ComparativeAnalyticsData | null;
  segmentComparison: SegmentComparisonData | null;
}

export function AnalyticsFunnel({ compareMode, funnel, maxFunnel, comparison, segmentComparison }: AnalyticsFunnelProps) {
  return (
    <div className="rounded-card border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Conversion Funnel</h3>
        {compareMode === "previous" && (
          <div className="flex items-center gap-3 text-2xs text-text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-control bg-brand" /> Current Period
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-control bg-text-muted/40" /> Previous Period
            </span>
          </div>
        )}
        {compareMode === "segments" && (
          <div className="flex items-center gap-3 text-2xs text-text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-control bg-brand" /> Mobile
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
              <div key={step1.step} className="rounded-card border bg-surface-sunken/20 p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-text">
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
                  <div className="mb-0.5 flex justify-between text-2xs text-text-muted">
                    <span>Mobile</span>
                    <span>{step1.count.toLocaleString()}</span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-control bg-surface-sunken">
                    <div
                      className="h-full rounded-control bg-brand transition-all"
                      style={{ width: `${Math.max((step1.count / maxStep) * 100, step1.count > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>

                {/* Desktop bar */}
                <div>
                  <div className="mb-0.5 flex justify-between text-2xs text-text-muted">
                    <span>Desktop</span>
                    <span>{step2.count.toLocaleString()}</span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-control bg-surface-sunken">
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
                  <div className="flex items-center gap-2 text-text-muted">
                    <span>{step.count.toLocaleString()}</span>
                    {prevStepCount !== null && (
                      <span className="text-2xs text-text-muted">
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
                  <div className="h-5 w-full overflow-hidden rounded-control bg-surface-sunken">
                    <div
                      className="flex h-full items-center justify-end rounded-control bg-brand pr-2 text-2xs font-medium text-text-on-accent transition-all"
                      style={{
                        width: `${Math.max(
                          (step.count / maxFunnel) * 100,
                          step.count > 0 ? 8 : 0
                        )}%`,
                      }}
                    />
                  </div>
                  {prevStepCount !== null && (
                    <div className="h-2 w-full overflow-hidden rounded-control bg-surface-sunken/60">
                      <div
                        className="h-full rounded-control bg-text-muted/40 transition-all"
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
                  <p className="mt-0.5 text-right text-2xs text-text-muted">
                    −{step.dropOffPercent}% drop-off
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
