/** Colour swatches offered in the widget theme editor. These are user-facing data
 *  (the colour a customer picks for their embedded widget), not design tokens. */
export const PRIMARY_COLOR_PRESETS = [
  { name: "Coral", hex: "#d9471b" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Dark Slate", hex: "#0f172a" },
] as const;

export const ACCENT_COLOR_PRESETS = [
  { name: "White", hex: "#ffffff" },
  { name: "Light Slate", hex: "#f8fafc" },
  { name: "Soft Zinc", hex: "#f4f4f5" },
  { name: "Dark Slate", hex: "#0f172a" },
] as const;
