"use client";

import { useEffect, useState } from "react";
import type { CreateExperimentInput } from "@/lib/validations/experiments";
import type { ExperimentWithStats } from "@/lib/experiments/queries";
import { buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { notify } from "@/lib/notify";
import { INITIAL_FORM, formForType, type ExperimentFormData, type ExperimentType } from "./experiment-form";
import { ExperimentDetail } from "./experiment-detail";
import { ExperimentList, type ExperimentFilter } from "./experiment-list";
import { CreateExperimentDialog } from "./create-experiment-dialog";

interface ExperimentsViewProps {
  spaceId: string;
}

export function ExperimentsView({ spaceId }: ExperimentsViewProps) {
  const confirm = useConfirm();
  const [experiments, setExperiments] = useState<ExperimentWithStats[]>([]);
  const [selectedExp, setSelectedExp] = useState<ExperimentWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ExperimentFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Create modal state
  const [formData, setFormData] = useState<ExperimentFormData>(INITIAL_FORM);

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
    setFormData(INITIAL_FORM);
  }

  function handleTypeChange(newType: ExperimentType) {
    setFormData(formForType(formData, newType));
  }

  const filteredExperiments = experiments.filter((e) => {
    if (filter === "all") return true;
    return e.status === filter;
  });

  function openCreate() {
    resetForm();
    setIsCreateOpen(true);
  }

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
          onClick={openCreate}
          className={buttonVariants({ variant: "primary", size: "sm" })}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Experiment
        </button>
      </div>


      {selectedExp ? (
        <ExperimentDetail
          selectedExp={selectedExp}
          actionLoading={actionLoading}
          onBack={() => setSelectedExp(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onApplyWinner={handleApplyWinner}
        />
      ) : (
        <ExperimentList
          experiments={experiments}
          filteredExperiments={filteredExperiments}
          filter={filter}
          loading={loading}
          actionLoading={actionLoading}
          onFilterChange={setFilter}
          onSelect={setSelectedExp}
          onStatusChange={handleStatusChange}
          onCreate={openCreate}
        />
      )}

      {isCreateOpen && (
        <CreateExperimentDialog
          formData={formData}
          setFormData={setFormData}
          actionLoading={actionLoading}
          onTypeChange={handleTypeChange}
          onCreate={handleCreate}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </div>
  );
}
