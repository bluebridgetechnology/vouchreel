"use client";

import { WIDGET_POSITIONS, WIDGET_TEMPLATES, TRIGGER_TYPES } from "@/lib/validations/widget-config";
import { cn } from "@/lib/utils";
import { inputClass } from "@/components/ui/input";
import type { ExperimentFormData } from "./experiment-form";
import { cardVariants } from "@/components/ui/card";

/** What differs between the control (A) and the test variant (B) editors. */
const SLOTS = {
  control: {
    title: "Variant A (Control)",
    extraClass: "",
    trafficClass: "text-2xs font-medium text-text-muted",
    placeholder: "Control Name",
    nameKey: "controlName",
    configKey: "controlConfig",
    defaultTrigger: "delay",
    defaultSeconds: 5,
    defaultPosition: "bottom-right",
    defaultTemplate: "floating-card",
  },
  variant: {
    title: "Variant B (Test Variant)",
    extraClass: " border-brand/40",
    trafficClass: "text-2xs font-medium text-brand",
    placeholder: "Variant B Name",
    nameKey: "variantName",
    configKey: "variantConfig",
    defaultTrigger: "exit-intent",
    defaultSeconds: 3,
    defaultPosition: "bottom-left",
    defaultTemplate: "wall-of-love",
  },
} as const;

interface VariantEditorProps {
  slot: keyof typeof SLOTS;
  formData: ExperimentFormData;
  onChange: (next: ExperimentFormData) => void;
}

export function VariantEditor({ slot, formData, onChange }: VariantEditorProps) {
  const s = SLOTS[slot];
  const config = formData[s.configKey];
  const traffic = slot === "control" ? formData.split : 100 - formData.split;
  const setConfig = (next: Record<string, unknown>) => onChange({ ...formData, [s.configKey]: next });

  return (
    <div className={cn(cardVariants({ variant: "flat" }), "p-3.5 space-y-3", s.extraClass)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text">{s.title}</span>
        <span className={s.trafficClass}>{traffic}% Traffic</span>
      </div>

      <input
        type="text"
        value={formData[s.nameKey]}
        onChange={(e) => onChange({ ...formData, [s.nameKey]: e.target.value })}
        placeholder={s.placeholder}
        className={cn(inputClass, "w-full text-xs")}
      />

      {formData.type === "trigger" && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-2xs text-text-muted">Trigger</label>
            <select
              value={(config.type as string) || s.defaultTrigger}
              onChange={(e) =>
                setConfig({
                  ...config,
                  type: e.target.value,
                  value: e.target.value === "delay" ? { seconds: s.defaultSeconds } : {},
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
          {config.type === "delay" && (
            <div>
              <label className="text-2xs text-text-muted">Delay (sec)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={((config.value as Record<string, unknown>)?.seconds as number) || s.defaultSeconds}
                onChange={(e) => setConfig({ ...config, value: { seconds: Number(e.target.value) || 1 } })}
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
            value={(config.position as string) || s.defaultPosition}
            onChange={(e) => setConfig({ position: e.target.value })}
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
            value={(config.template as string) || s.defaultTemplate}
            onChange={(e) => setConfig({ template: e.target.value })}
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
  );
}
