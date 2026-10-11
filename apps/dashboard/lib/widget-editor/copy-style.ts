import type { WidgetTemplate, WidgetTheme } from "@/lib/validations/widget-config";
import { normalizeTheme } from "@/lib/validations/widget-config";
import { shapeForLayout } from "./layouts";

/**
 * "Copy style": the look of one widget onto another. It carries colours, mode, corners, shape, size, shadow,
 * border, glass, play button, entrance and spacing. It leaves alone what a widget shows and how it behaves
 * (name / company / stars / source / quote, columns, auto-advance), since those belong to the widget's job
 * rather than its look. A shape the target's layout cannot use goes back to that layout's own look.
 */
export const STYLE_FIELDS = [
  "primaryColor",
  "accentColor",
  "mode",
  "borderRadius",
  "background",
  "textColor",
  "size",
  "shadow",
  "borderWidth",
  "borderColor",
  "glass",
  "playButtonStyle",
  "gap",
  "entrance",
] as const;

export function copyStyle(source: unknown, target: unknown, targetTemplate: WidgetTemplate): Required<WidgetTheme> {
  const from = normalizeTheme(source);
  const result: Required<WidgetTheme> = { ...normalizeTheme(target) };
  for (const field of STYLE_FIELDS) (result as Record<string, unknown>)[field] = from[field];
  result.shape = shapeForLayout(from.shape, targetTemplate);
  return result;
}
