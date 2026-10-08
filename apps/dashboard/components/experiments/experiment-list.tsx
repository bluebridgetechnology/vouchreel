"use client";

import type { ExperimentWithStats } from "@/lib/experiments/queries";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { toggleStyle } from "@/components/ui/toggle";
import { ListSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";
import { Card } from "@/components/ui/card";

export type ExperimentFilter = "all" | "running" | "draft" | "completed";

interface ExperimentListProps {
  experiments: ExperimentWithStats[];
  filteredExperiments: ExperimentWithStats[];
  filter: ExperimentFilter;
  loading: boolean;
  actionLoading: boolean;
  onFilterChange: (filter: ExperimentFilter) => void;
  onSelect: (exp: ExperimentWithStats) => void;
  onStatusChange: (id: string, status: "draft" | "running" | "completed") => void;
  onCreate: () => void;
}

export function ExperimentList({ experiments, filteredExperiments, filter, loading, actionLoading, onFilterChange, onSelect, onStatusChange, onCreate }: ExperimentListProps) {
  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b pb-3 text-xs font-medium">
        {(
          [
            ["all", "All"],
            ["running", "Running"],
            ["draft", "Draft"],
            ["completed", "Completed"],
          ] as const
        ).map(([key, label]) => {
          const count =
            key === "all"
              ? experiments.length
              : experiments.filter((e) => e.status === key).length;
          return (
            <button
              key={key}
              onClick={() => onFilterChange(key)}
              className={cn("rounded-control px-3 py-1.5 transition", toggleStyle("solid", filter === key))}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonRegion label="Loading experiments">
          <ListSkeleton rows={3} />
        </SkeletonRegion>
      ) : filteredExperiments.length === 0 ? (
        <div className="rounded-card border border-dashed p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-brand-soft text-brand">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-text">No experiments found</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            Create an experiment to start testing different triggers, positions, or templates on your visitors.
          </p>
          <button
            onClick={onCreate}
            className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-2")}
          >
            Create Experiment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredExperiments.map((exp) => (
            <Card
              key={exp.id}
              variant="flat" className="p-5 shadow-sm hover:border-brand/50 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-base text-text">{exp.name}</span>
                  <span
                    className={`rounded-pill px-2.5 py-0.5 text-2xs font-medium uppercase tracking-wider ${
                      exp.status === "running"
                        ? "bg-success-soft text-success-foreground"
                        : exp.status === "completed"
                        ? "bg-brand-soft text-brand"
                        : "bg-warning-soft text-warning-foreground"
                    }`}
                  >
                    {exp.status}
                  </span>
                  <span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-2xs font-medium text-text-muted uppercase">
                    {exp.type}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>Traffic Split: {exp.trafficSplit?.join("/")}%</span>
                  <span>•</span>
                  <span>{exp.variants?.length || 0} variants</span>
                  <span>•</span>
                  <span>
                    Created {new Date(exp.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Summary performance stats */}
              <div className="flex items-center gap-6 text-center">
                <div>
                  <div className="text-2xs uppercase font-medium text-text-muted">Impressions</div>
                  <div className="text-sm font-medium text-text">
                    {exp.totalImpressions.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-2xs uppercase font-medium text-text-muted">Conversions</div>
                  <div className="text-sm font-medium text-text">
                    {exp.totalConversions.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-2xs uppercase font-medium text-text-muted">CR</div>
                  <div className="text-sm font-medium text-brand">
                    {exp.overallConversionRate}%
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  onClick={() => onSelect(exp)}
                  className={buttonVariants({ variant: "primary", size: "sm" })}
                >
                  View Results
                </button>
                {exp.status === "draft" && (
                  <button
                    disabled={actionLoading}
                    onClick={() => onStatusChange(exp.id, "running")}
                    className={buttonVariants({ variant: "success", size: "sm" })}
                  >
                    Start
                  </button>
                )}
                {exp.status === "running" && (
                  <button
                    disabled={actionLoading}
                    onClick={() => onStatusChange(exp.id, "completed")}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Complete
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
