"use client";

import { EXPERIMENT_TYPES } from "@/lib/validations/experiments";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { toggleStyle } from "@/components/ui/toggle";
import { ModalOverlay } from "@/components/ui/modal";
import { VariantEditor } from "./variant-editor";
import type { ExperimentFormData, ExperimentType } from "./experiment-form";

interface CreateExperimentDialogProps {
  formData: ExperimentFormData;
  setFormData: (next: ExperimentFormData) => void;
  actionLoading: boolean;
  onTypeChange: (type: ExperimentType) => void;
  onCreate: (startImmediately: boolean) => void;
  onClose: () => void;
}

export function CreateExperimentDialog({ formData, setFormData, actionLoading, onTypeChange, onCreate, onClose }: CreateExperimentDialogProps) {
  return (
    <ModalOverlay label="Create experiment" onClose={onClose}>
      <div className="w-full max-w-xl rounded-card border bg-surface p-4 sm:p-6 shadow-float space-y-6 animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="text-lg font-medium text-text">Create New Experiment</h3>
            <p className="text-xs text-text-muted">
              A/B test two variations to determine which drives higher visitor conversions.
            </p>
          </div>
          <button
            onClick={onClose}
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
                  onClick={() => onTypeChange(t)}
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
            <VariantEditor slot="control" formData={formData} onChange={setFormData} />
            <VariantEditor slot="variant" formData={formData} onChange={setFormData} />
          </div>
        </div>


        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            disabled={actionLoading}
            onClick={onClose}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => onCreate(false)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Save as Draft
          </button>
          <Button
            type="button"
            disabled={actionLoading}
            onClick={() => onCreate(true)}
            size="sm" loading={actionLoading}
          >
            {actionLoading ? "Creating..." : "Create & Start Now"}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
