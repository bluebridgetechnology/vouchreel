import type { WidgetTheme } from "@/lib/validations/widget-config";

/**
 * One-click looks for the widget. A preset sets how the widget looks (surface, corners, depth, motion), never
 * the owner's brand colour or the text on it, so any preset still looks like their brand. They are code, not
 * database rows: validated by the same schema as a saved theme, and checked for readable contrast in tests.
 * Colour values here are user-facing data (what the widget will show), not design tokens.
 */

/** The theme fields a preset sets. Everything else (brand colours, content toggles, columns) stays the owner's. */
export const PRESET_FIELDS = [
  "mode",
  "background",
  "textColor",
  "borderRadius",
  "size",
  "shadow",
  "borderWidth",
  "borderColor",
  "glass",
  "playButtonStyle",
  "entrance",
  "gap",
] as const;

export type PresetTheme = Required<Pick<WidgetTheme, (typeof PRESET_FIELDS)[number]>>;

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  theme: PresetTheme;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Flat, quiet, a thin line",
    theme: { mode: "light", background: null, textColor: null, borderRadius: 8, size: "md", shadow: "none", borderWidth: 1, borderColor: null, glass: false, playButtonStyle: "minimal", entrance: "fade", gap: "normal" },
  },
  {
    id: "soft",
    name: "Soft",
    description: "Warm cream, round corners",
    theme: { mode: "light", background: "#fffaf3", textColor: "#3b2f2a", borderRadius: 20, size: "md", shadow: "soft", borderWidth: 0, borderColor: null, glass: false, playButtonStyle: "circle", entrance: "slide", gap: "loose" },
  },
  {
    id: "bold",
    name: "Bold",
    description: "Big, strong shadow, solid play",
    theme: { mode: "light", background: null, textColor: null, borderRadius: 4, size: "lg", shadow: "strong", borderWidth: 2, borderColor: "#1c1917", glass: false, playButtonStyle: "solid", entrance: "pop", gap: "normal" },
  },
  {
    id: "glass",
    name: "Glass",
    description: "Frosted, floats over the page",
    theme: { mode: "light", background: null, textColor: null, borderRadius: 24, size: "md", shadow: "soft", borderWidth: 1, borderColor: null, glass: true, playButtonStyle: "circle", entrance: "fade", gap: "normal" },
  },
  {
    id: "cinema",
    name: "Dark cinema",
    description: "Deep dark, made for video",
    theme: { mode: "dark", background: "#0c0a09", textColor: "#fafaf9", borderRadius: 12, size: "lg", shadow: "strong", borderWidth: 0, borderColor: null, glass: false, playButtonStyle: "minimal", entrance: "fade", gap: "tight" },
  },
  {
    id: "outline",
    name: "Outline",
    description: "Sharp lines, no shadow",
    theme: { mode: "light", background: null, textColor: null, borderRadius: 0, size: "md", shadow: "none", borderWidth: 2, borderColor: "#d6d3d1", glass: false, playButtonStyle: "solid", entrance: "slide", gap: "tight" },
  },
];

/** The preset whose fields all match the theme, if one does. */
export function matchingPreset(theme: Required<WidgetTheme>): StylePreset | null {
  return STYLE_PRESETS.find((p) => PRESET_FIELDS.every((f) => theme[f] === p.theme[f])) ?? null;
}

/** The theme with a preset applied: the preset's fields replaced, the owner's other choices kept. */
export function applyPreset<T extends WidgetTheme>(theme: T, preset: StylePreset): T {
  return { ...theme, ...preset.theme };
}
