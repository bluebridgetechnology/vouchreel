export type ExperimentType = "trigger" | "position" | "template";

export interface ExperimentFormData {
  name: string;
  type: ExperimentType;
  controlName: string;
  variantName: string;
  controlConfig: Record<string, unknown>;
  variantConfig: Record<string, unknown>;
  /** Share of traffic for the control, e.g. 50 (meaning 50/50). */
  split: number;
}

export const INITIAL_FORM: ExperimentFormData = {
  name: "",
  type: "trigger",
  controlName: "Control (Delay 5s)",
  variantName: "Variant B (Exit Intent)",
  controlConfig: { type: "delay", value: { seconds: 5 } },
  variantConfig: { type: "exit-intent", value: {} },
  split: 50,
};

/** The form after switching type: names and configs reset to that type's sensible pair. */
export function formForType(form: ExperimentFormData, type: ExperimentType): ExperimentFormData {
  if (type === "trigger") {
    return {
      ...form,
      type,
      controlName: "Control (Delay 5s)",
      variantName: "Variant B (Exit Intent)",
      controlConfig: { type: "delay", value: { seconds: 5 } },
      variantConfig: { type: "exit-intent", value: {} },
    };
  }
  if (type === "position") {
    return {
      ...form,
      type,
      controlName: "Control (Bottom Right)",
      variantName: "Variant B (Bottom Left)",
      controlConfig: { position: "bottom-right" },
      variantConfig: { position: "bottom-left" },
    };
  }
  return {
    ...form,
    type,
    controlName: "Control (Floating Card)",
    variantName: "Variant B (Wall of Love)",
    controlConfig: { template: "floating-card" },
    variantConfig: { template: "wall-of-love" },
  };
}
