"use client";

import { useEffect, useState } from "react";
import {
  EXPERIMENT_TYPES,
  type CreateExperimentInput,
} from "@/lib/validations/experiments";
import {
  WIDGET_POSITIONS,
  WIDGET_TEMPLATES,
  TRIGGER_TYPES,
} from "@/lib/validations/widget-config";
import type { ExperimentWithStats, VariantStats } from "@/lib/experiments/queries";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { toggleStyle } from "@/components/ui/toggle";
import { ModalOverlay } from "@/components/ui/modal";
import { useConfirm } from "@/components/ui/confirm";
import { notify } from "@/lib/notify";

interface ExperimentsViewProps {
  spaceId: string;
}

export function ExperimentsView({ spaceId }: ExperimentsViewProps) {
  const confirm = useConfirm();
  const [experiments, setExperiments] = useState<ExperimentWithStats[]>([]);
  const [selectedExp, setSelectedExp] = useState<ExperimentWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "running" | "draft" | "completed">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Create modal state
  const [formData, setFormData] = useState<{
    name: string;
    type: "trigger" | "position" | "template";
    controlName: string;
    variantName: string;
    controlConfig: Record<string, unknown>;
    variantConfig: Record<string, unknown>;
    split: number; // e.g. 50 (meaning 50/50)
  }>({
    name: "",
    type: "trigger",
    controlName: "Control (Delay 5s)",
    variantName: "Variant B (Exit Intent)",
    controlConfig: { type: "delay", value: { seconds: 5 } },
    variantConfig: { type: "exit-intent", value: {} },
    split: 50,
  });

  useEffect(() => {
    loadExperiments();
  }, [spaceId]);

  async function loadExperiments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/experiments`);
      if (!res.ok) throw new Error("Failed to load experiments");
      const data = await res.json();
      setExperiments(data.experiments || []);

      // If an experiment was currently selected, refresh its details
      if (selectedExp) {
        const updated = (data.experiments || []).find((e: ExperimentWithStats) => e.id === selectedExp.id);
        if (updated) setSelectedExp(updated);
      }
    } catch (err) {
      console.error(err);
      notify.error("Could not load experiments");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(startImmediately = false) {
    if (!formData.name.trim()) {
      notify.error("Please provide an experiment name");
      return;
    }

    setActionLoading(true);
    try {
      const payload: CreateExperimentInput = {
        name: formData.name.trim(),
        type: formData.type,
        variants: [
          {
            id: "control",
            name: formData.controlName || "Control",
            config: formData.controlConfig,
          },
          {
            id: "variant-b",
            name: formData.variantName || "Variant B",
            config: formData.variantConfig,
          },
        ],
        trafficSplit: [formData.split, 100 - formData.split],
      };

      const res = await fetch(`/api/spaces/${spaceId}/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson?.error?.message || "Failed to create experiment");
      }

      const { experiment } = await res.json();

      if (startImmediately && experiment?.id) {
        await fetch(`/api/spaces/${spaceId}/experiments/${experiment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "running" }),
        });
      }

      notify.success(`Experiment created successfully${startImmediately ? " and started!" : " as draft."}`);
      setIsCreateOpen(false);
      resetForm();
      await loadExperiments();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error creating experiment");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStatusChange(expId: string, status: "draft" | "running" | "completed") {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/experiments/${expId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      notify.success(`Experiment status updated to ${status}`);
      await loadExperiments();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error updating status");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(expId: string) {
    if (!(await confirm({ title: "Delete this experiment?", description: "Its results and variants will be removed.", confirmLabel: "Delete experiment", tone: "danger" }))) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/experiments/${expId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete experiment");
      notify.success("Experiment deleted");
      if (selectedExp?.id === expId) setSelectedExp(null);
      await loadExperiments();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error deleting experiment");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApplyWinner(expId: string, variantIndex: number, variantName: string) {
    if (
      !(await confirm({ title: `Apply "${variantName}" as the winner?`, description: "This updates your live widget settings and marks the experiment as completed.", confirmLabel: "Apply winner", tone: "default" }))
    ) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/experiments/${expId}/apply-winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantIndex }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson?.error?.message || "Failed to apply winner");
      }

      notify.success(`Applied "${variantName}" to your widget! Experiment marked as completed.`);
      await loadExperiments();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error applying winner");
    } finally {
      setActionLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      type: "trigger",
      controlName: "Control (Delay 5s)",
      variantName: "Variant B (Exit Intent)",
      controlConfig: { type: "delay", value: { seconds: 5 } },
      variantConfig: { type: "exit-intent", value: {} },
      split: 50,
    });
  }

  function handleTypeChange(newType: "trigger" | "position" | "template") {
    if (newType === "trigger") {
      setFormData({
        ...formData,
        type: newType,
        controlName: "Control (Delay 5s)",
        variantName: "Variant B (Exit Intent)",
        controlConfig: { type: "delay", value: { seconds: 5 } },
        variantConfig: { type: "exit-intent", value: {} },
      });
    } else if (newType === "position") {
      setFormData({
        ...formData,
        type: newType,
        controlName: "Control (Bottom Right)",
        variantName: "Variant B (Bottom Left)",
        controlConfig: { position: "bottom-right" },
        variantConfig: { position: "bottom-left" },
      });
    } else if (newType === "template") {
      setFormData({
        ...formData,
        type: newType,
        controlName: "Control (Floating Card)",
        variantName: "Variant B (Wall of Love)",
        controlConfig: { template: "floating-card" },
        variantConfig: { template: "wall-of-love" },
      });
    }
  }

  const filteredExperiments = experiments.filter((e) => {
    if (filter === "all") return true;
    return e.status === filter;
  });

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-text">
            A/B Testing Experiments
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Optimize conversion rates by deterministically testing widget triggers, positions, and templates.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className={buttonVariants({ variant: "primary", size: "sm" })}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Experiment
        </button>
      </div>


      {/* Detail View of Selected Experiment */}
      {selectedExp ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedExp(null)}
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
                  onClick={() => handleStatusChange(selectedExp.id, "running")}
                  className={buttonVariants({ variant: "success", size: "sm" })}
                >
                  Start Experiment
                </button>
              )}
              {selectedExp.status === "running" && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleStatusChange(selectedExp.id, "completed")}
                  className={buttonVariants({ variant: "warning", size: "sm" })}
                >
                  Stop Experiment
                </button>
              )}
              {selectedExp.status === "completed" && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleStatusChange(selectedExp.id, "running")}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Resume Experiment
                </button>
              )}
              <button
                disabled={actionLoading}
                onClick={() => handleDelete(selectedExp.id)}
                className={buttonVariants({ variant: "outline-danger", size: "sm" })}
              >
                Delete
              </button>
            </div>
          </div>

          {/* Experiment Title & Header Card */}
          <div className="rounded-card border bg-surface p-4 sm:p-6 shadow-sm">
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
          </div>

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
                  className={`rounded-card border bg-surface p-6 shadow-sm space-y-5 transition-all ${
                    isWinner ? "border-brand ring-2 ring-brand/30" : ""
                  }`}
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
                  <div className="space-y-1.5 text-xs border rounded-card p-3 bg-surface">
                    <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                      Variant Configuration
                    </span>
                    <pre className="font-mono text-2xs text-text-muted overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(variant.config, null, 2)}
                    </pre>
                  </div>

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
                      onClick={() => handleApplyWinner(selectedExp.id, idx, variant.name)}
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
      ) : (
        /* Experiments List View */
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
                  onClick={() => setFilter(key)}
                  className={cn("rounded-control px-3 py-1.5 transition", toggleStyle("solid", filter === key))}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-text-muted">
              Loading experiments...
            </div>
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
                onClick={() => {
                  resetForm();
                  setIsCreateOpen(true);
                }}
                className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-2")}
              >
                Create Experiment
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredExperiments.map((exp) => (
                <div
                  key={exp.id}
                  className="rounded-card border bg-surface p-5 shadow-sm hover:border-brand/50 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
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
                      onClick={() => setSelectedExp(exp)}
                      className={buttonVariants({ variant: "primary", size: "sm" })}
                    >
                      View Results
                    </button>
                    {exp.status === "draft" && (
                      <button
                        disabled={actionLoading}
                        onClick={() => handleStatusChange(exp.id, "running")}
                        className={buttonVariants({ variant: "success", size: "sm" })}
                      >
                        Start
                      </button>
                    )}
                    {exp.status === "running" && (
                      <button
                        disabled={actionLoading}
                        onClick={() => handleStatusChange(exp.id, "completed")}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Experiment Modal Dialog */}
      {isCreateOpen && (
        <ModalOverlay label="Create experiment" onClose={() => setIsCreateOpen(false)}>
          <div className="w-full max-w-xl rounded-card border bg-surface p-4 sm:p-6 shadow-float space-y-6 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-medium text-text">Create New Experiment</h3>
                <p className="text-xs text-text-muted">
                  A/B test two variations to determine which drives higher visitor conversions.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Experiment Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Experiment Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Exit Intent vs 5s Delay"
                  className={cn(inputClass, "w-full text-xs")}
                />
              </div>

              {/* Experiment Type Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Experiment Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPERIMENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeChange(t)}
                      className={cn("rounded-card border p-3 text-left transition-all", toggleStyle("choice", formData.type === t))}
                    >
                      <div className="font-medium text-xs uppercase text-text">{t}</div>
                      <div className="text-2xs text-text-muted mt-0.5 capitalize">
                        Test {t}s
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Traffic Split */}
              <div className="space-y-2 rounded-card border bg-surface-sunken/20 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium uppercase tracking-wider text-text-muted">
                    Traffic Split
                  </span>
                  <span className="font-medium text-text">
                    {formData.split}% Control / {100 - formData.split}% Variant B
                  </span>
                </div>

                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={formData.split}
                  onChange={(e) => setFormData({ ...formData, split: Number(e.target.value) })}
                  className="w-full accent-primary cursor-pointer"
                />

                <div className="flex items-center gap-2 pt-1">
                  {[50, 70, 80].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormData({ ...formData, split: preset })}
                      className={cn("rounded-control border px-2.5 py-1 text-2xs font-medium transition", toggleStyle("solid", formData.split === preset))}
                    >
                      {preset} / {100 - preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variant Configurations */}
              <div className="space-y-4 pt-1">
                {/* Variant 0 (Control) */}
                <div className="rounded-card border p-3.5 space-y-3 bg-surface">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text">
                      Variant A (Control)
                    </span>
                    <span className="text-2xs font-medium text-text-muted">
                      {formData.split}% Traffic
                    </span>
                  </div>

                  <input
                    type="text"
                    value={formData.controlName}
                    onChange={(e) => setFormData({ ...formData, controlName: e.target.value })}
                    placeholder="Control Name"
                    className={cn(inputClass, "w-full text-xs")}
                  />

                  {formData.type === "trigger" && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-2xs text-text-muted">Trigger</label>
                        <select
                          value={(formData.controlConfig.type as string) || "delay"}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              controlConfig: {
                                ...formData.controlConfig,
                                type: e.target.value,
                                value: e.target.value === "delay" ? { seconds: 5 } : {},
                              },
                            })
                          }
                          className={cn(inputClass, "w-full text-xs")}
                        >
                          {TRIGGER_TYPES.map((trig) => (
                            <option key={trig} value={trig}>
                              {trig}
                            </option>
                          ))}
                        </select>
                      </div>
                      {formData.controlConfig.type === "delay" && (
                        <div>
                          <label className="text-2xs text-text-muted">Delay (sec)</label>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={
                              ((formData.controlConfig.value as Record<string, unknown>)?.seconds as number) || 5
                            }
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                controlConfig: {
                                  ...formData.controlConfig,
                                  value: { seconds: Number(e.target.value) || 1 },
                                },
                              })
                            }
                            className={cn(inputClass, "w-full text-xs")}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {formData.type === "position" && (
                    <div>
                      <label className="text-2xs text-text-muted">Position</label>
                      <select
                        value={(formData.controlConfig.position as string) || "bottom-right"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            controlConfig: { position: e.target.value },
                          })
                        }
                        className={cn(inputClass, "w-full text-xs")}
                      >
                        {WIDGET_POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.type === "template" && (
                    <div>
                      <label className="text-2xs text-text-muted">Template</label>
                      <select
                        value={(formData.controlConfig.template as string) || "floating-card"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            controlConfig: { template: e.target.value },
                          })
                        }
                        className={cn(inputClass, "w-full text-xs")}
                      >
                        {WIDGET_TEMPLATES.map((tmpl) => (
                          <option key={tmpl} value={tmpl}>
                            {tmpl}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Variant 1 (Variant B) */}
                <div className="rounded-card border p-3.5 space-y-3 bg-surface border-brand/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text">
                      Variant B (Test Variant)
                    </span>
                    <span className="text-2xs font-medium text-brand">
                      {100 - formData.split}% Traffic
                    </span>
                  </div>

                  <input
                    type="text"
                    value={formData.variantName}
                    onChange={(e) => setFormData({ ...formData, variantName: e.target.value })}
                    placeholder="Variant B Name"
                    className={cn(inputClass, "w-full text-xs")}
                  />

                  {formData.type === "trigger" && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-2xs text-text-muted">Trigger</label>
                        <select
                          value={(formData.variantConfig.type as string) || "exit-intent"}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              variantConfig: {
                                ...formData.variantConfig,
                                type: e.target.value,
                                value: e.target.value === "delay" ? { seconds: 3 } : {},
                              },
                            })
                          }
                          className={cn(inputClass, "w-full text-xs")}
                        >
                          {TRIGGER_TYPES.map((trig) => (
                            <option key={trig} value={trig}>
                              {trig}
                            </option>
                          ))}
                        </select>
                      </div>
                      {formData.variantConfig.type === "delay" && (
                        <div>
                          <label className="text-2xs text-text-muted">Delay (sec)</label>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={
                              ((formData.variantConfig.value as Record<string, unknown>)?.seconds as number) || 3
                            }
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                variantConfig: {
                                  ...formData.variantConfig,
                                  value: { seconds: Number(e.target.value) || 1 },
                                },
                              })
                            }
                            className={cn(inputClass, "w-full text-xs")}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {formData.type === "position" && (
                    <div>
                      <label className="text-2xs text-text-muted">Position</label>
                      <select
                        value={(formData.variantConfig.position as string) || "bottom-left"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            variantConfig: { position: e.target.value },
                          })
                        }
                        className={cn(inputClass, "w-full text-xs")}
                      >
                        {WIDGET_POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.type === "template" && (
                    <div>
                      <label className="text-2xs text-text-muted">Template</label>
                      <select
                        value={(formData.variantConfig.template as string) || "wall-of-love"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            variantConfig: { template: e.target.value },
                          })
                        }
                        className={cn(inputClass, "w-full text-xs")}
                      >
                        {WIDGET_TEMPLATES.map((tmpl) => (
                          <option key={tmpl} value={tmpl}>
                            {tmpl}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 border-t pt-4">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setIsCreateOpen(false)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleCreate(false)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleCreate(true)}
                className={buttonVariants({ variant: "primary", size: "sm" })}
              >
                {actionLoading ? "Creating..." : "Create & Start Now"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
