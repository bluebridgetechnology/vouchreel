"use client";

import type { ExperimentWithStats } from "@/lib/experiments/queries";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cardVariants } from "@/components/ui/card";

interface ExperimentDetailProps {
  selectedExp: ExperimentWithStats;
  actionLoading: boolean;
  onBack: () => void;
  onStatusChange: (id: string, status: "draft" | "running" | "completed") => void;
  onDelete: (id: string) => void;
  onApplyWinner: (id: string, variantIndex: number, variantName: string) => void;
}

export function ExperimentDetail({ selectedExp, actionLoading, onBack, onStatusChange, onDelete, onApplyWinner }: ExperimentDetailProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-xs")}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to all experiments
        </button>

        <div className="flex items-center gap-2">
          {selectedExp.status === "draft" && (
            <button
              disabled={actionLoading}
              onClick={() => onStatusChange(selectedExp.id, "running")}
              className={buttonVariants({ variant: "success", size: "sm" })}
            >
              Start Experiment
            </button>
          )}
          {selectedExp.status === "running" && (
            <button
              disabled={actionLoading}
              onClick={() => onStatusChange(selectedExp.id, "completed")}
              className={buttonVariants({ variant: "warning", size: "sm" })}
            >
              Stop Experiment
            </button>
          )}
          {selectedExp.status === "completed" && (
            <button
              disabled={actionLoading}
              onClick={() => onStatusChange(selectedExp.id, "running")}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Resume Experiment
            </button>
          )}
          <button
            disabled={actionLoading}
            onClick={() => onDelete(selectedExp.id)}
            className={buttonVariants({ variant: "outline-danger", size: "sm" })}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Experiment Title & Header Card */}
      <Card variant="flat" className="p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-medium text-text">{selectedExp.name}</h3>
              <span
                className={`rounded-pill px-2.5 py-0.5 text-2xs font-medium uppercase tracking-wider ${
                  selectedExp.status === "running"
                    ? "bg-success-soft text-success-foreground"
                    : selectedExp.status === "completed"
                    ? "bg-brand-soft text-brand"
                    : "bg-warning-soft text-warning-foreground"
                }`}
              >
                {selectedExp.status}
              </span>
              <span className="rounded-pill bg-surface-sunken px-2.5 py-0.5 text-2xs font-medium text-text-muted uppercase">
                {selectedExp.type}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Traffic Allocation: {selectedExp.trafficSplit?.join("% / ")}% • Created on{" "}
              {new Date(selectedExp.createdAt).toLocaleDateString()}
              {selectedExp.startedAt && ` • Started ${new Date(selectedExp.startedAt).toLocaleDateString()}`}
              {selectedExp.endedAt && ` • Completed ${new Date(selectedExp.endedAt).toLocaleDateString()}`}
            </p>
          </div>

          {/* Total overview badges */}
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-xs text-text-muted">Total Impressions</div>
              <div className="text-lg font-medium text-text">
                {selectedExp.totalImpressions.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Conversions</div>
              <div className="text-lg font-medium text-text">
                {selectedExp.totalConversions.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Overall CR</div>
              <div className="text-lg font-medium text-brand">
                {selectedExp.overallConversionRate}%
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Statistical Significance Banner */}
      {(() => {
        const variantB = selectedExp.variants[1];
        const sig = variantB?.significance;

        if (!sig) return null;

        if (!sig.sampleSizeMet) {
          return (
            <div className="flex items-start gap-3 rounded-card border border-info/30 bg-info-soft p-5">
              <div className="rounded-card bg-info-soft p-2 text-info-foreground">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-info-foreground">
                  Collecting Sample Data
                </h4>
                <p className="mt-0.5 text-xs text-info-foreground">
                  A minimum of 30 impressions and 3 conversions per variant are required before calculating statistical significance. Current: Control ({selectedExp.variants[0]?.impressions}/30 impressions, {selectedExp.variants[0]?.conversions}/3 conversions), Variant B ({variantB?.impressions}/30 impressions, {variantB?.conversions}/3 conversions).
                </p>
              </div>
            </div>
          );
        }

        if (sig.isSignificant) {
          return (
            <div className="flex items-start gap-3 rounded-card border border-success/30 bg-success-soft p-5 shadow-sm">
              <div className="rounded-card bg-success-soft p-2 text-success-foreground">
                <span className="text-xl">🏆</span>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-success-foreground">
                  {sig.confidence}% Confidence — Statistically Significant Winner Detected!
                </h4>
                <p className="text-xs text-success-foreground">
                  {sig.message} (z-score: {sig.zScore}, p-value: {sig.pValue}). You can apply this variant to roll it out permanently to all visitors.
                </p>
              </div>
            </div>
          );
        }

        return (
          <div className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft p-5">
            <div className="rounded-card bg-warning-soft p-2 text-warning-foreground">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-medium text-warning-foreground">
                No Significant Winner Yet
              </h4>
              <p className="mt-0.5 text-xs text-warning-foreground">
                {sig.message} (Current confidence: {sig.confidence ?? "<95"}%, p-value: {sig.pValue}). Keep the experiment running to reach 95% statistical confidence.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Per-Variant Performance Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {selectedExp.variants.map((variant, idx) => {
          const isControl = idx === 0;
          const isWinner = selectedExp.winnerVariantIndex === idx;

          return (
            <div
              key={variant.id}
              className={cn(
                cardVariants({ variant: "flat" }),
                "p-6 shadow-sm space-y-5 transition-all",
                isWinner && "border-brand ring-2 ring-brand/30"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-control px-2 py-0.5 text-2xs font-medium uppercase tracking-wider ${
                        isControl
                          ? "bg-surface-sunken text-text"
                          : "bg-info-soft text-info-foreground"
                      }`}
                    >
                      {isControl ? "Control (Variant A)" : `Variant ${String.fromCharCode(65 + idx)}`}
                    </span>
                    {isWinner && (
                      <span className="rounded-control bg-brand-soft px-2 py-0.5 text-2xs font-medium text-brand">
                        ★ Winner
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-medium text-text mt-1">
                    {variant.name}
                  </h4>
                </div>

                <div className="text-right">
                  <span className="text-xs font-medium text-text-muted">
                    {variant.trafficSplit}% Traffic
                  </span>
                </div>
              </div>

              {/* Primary KPI: Conversion Rate & Uplift */}
              <div className="rounded-card bg-surface-sunken/40 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-text-muted">
                    Conversion Rate
                  </div>
                  <div className="text-2xl font-medium text-text mt-0.5">
                    {variant.conversionRate}%
                  </div>
                </div>

                {!isControl && variant.significance?.sampleSizeMet && (
                  <div className="text-right">
                    <div className="text-2xs font-medium text-text-muted">
                      Uplift vs Control
                    </div>
                    <div
                      className={`inline-flex items-center gap-0.5 text-base font-medium ${
                        variant.significance.relativeUplift >= 0
                          ? "text-success-foreground"
                          : "text-danger-foreground"
                      }`}
                    >
                      {variant.significance.relativeUplift >= 0 ? "+" : ""}
                      {variant.significance.relativeUplift}%
                    </div>
                  </div>
                )}
              </div>

              {/* Configuration Inspector */}
              <Card variant="flat" className="space-y-1.5 text-xs p-3">
                <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                  Variant Configuration
                </span>
                <pre className="font-mono text-2xs text-text-muted overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(variant.config, null, 2)}
                </pre>
              </Card>

              {/* Detailed metrics breakdown */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t text-center">
                <div className="p-2 rounded-card bg-surface-sunken/20">
                  <div className="text-2xs font-medium text-text-muted">Impressions</div>
                  <div className="text-sm font-medium text-text mt-0.5">
                    {variant.impressions.toLocaleString()}
                  </div>
                </div>
                <div className="p-2 rounded-card bg-surface-sunken/20">
                  <div className="text-2xs font-medium text-text-muted">Plays ({variant.playRate}%)</div>
                  <div className="text-sm font-medium text-text mt-0.5">
                    {variant.plays.toLocaleString()}
                  </div>
                </div>
                <div className="p-2 rounded-card bg-surface-sunken/20">
                  <div className="text-2xs font-medium text-text-muted">Clicks ({variant.clickThroughRate}%)</div>
                  <div className="text-sm font-medium text-text mt-0.5">
                    {variant.clicks.toLocaleString()}
                  </div>
                </div>
                <div className="p-2 rounded-card bg-surface-sunken/20">
                  <div className="text-2xs font-medium text-text-muted">Conversions</div>
                  <div className="text-sm font-medium text-brand mt-0.5">
                    {variant.conversions.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Winner Action */}
              <div className="pt-2">
                <button
                  disabled={actionLoading || isWinner}
                  onClick={() => onApplyWinner(selectedExp.id, idx, variant.name)}
                  className={cn(buttonVariants({ variant: isWinner ? "soft" : "primary", size: "md" }), "w-full text-xs", isWinner && "cursor-default")}
                >
                  {isWinner ? "✓ Applied as Widget Winner" : "Apply as Winner to Widget"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
