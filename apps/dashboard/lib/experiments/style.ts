import { z } from "zod";
import { normalizeTheme, WIDGET_TEMPLATES, type WidgetTemplate, type WidgetTheme } from "@/lib/validations/widget-config";
import { shapeForLayout } from "@/lib/widget-editor/layouts";
import { applyPreset, STYLE_PRESETS } from "@/lib/widget-editor/presets";

/**
 * A "style" experiment compares looks: each variant is a layout and/or a look (one of the style presets) put on
 * top of the widget as it is published. Nothing is stored but the two choices, so the widget can still be edited
 * while the test runs and every variant follows. The server turns a variant into a complete layout and theme
 * before the script sees it, so the script needs no knowledge of this experiment type.
 */
export const styleVariantConfigSchema = z
  .object({
    /** A layout to show; leave out to keep the widget's own. */
    template: z.enum(WIDGET_TEMPLATES).optional(),
    /** A style preset id; leave out to keep the widget's own look. */
    preset: z.string().refine((id) => STYLE_PRESETS.some((p) => p.id === id), "Unknown look").optional(),
  })
  .strict();

export type StyleVariantConfig = z.infer<typeof styleVariantConfigSchema>;

/** What a variant shows: the widget's layout and theme with the variant's choices applied. Bad or missing config changes nothing. */
export function resolveStyleVariant(base: { template: WidgetTemplate; theme: unknown }, config: unknown): { template: WidgetTemplate; theme: Required<WidgetTheme> } {
  const parsed = styleVariantConfigSchema.safeParse(config);
  const choice = parsed.success ? parsed.data : {};
  const template = choice.template ?? base.template;
  let theme = normalizeTheme(base.theme);
  const preset = STYLE_PRESETS.find((p) => p.id === choice.preset);
  if (preset) theme = applyPreset(theme, preset);
  return { template, theme: { ...theme, shape: shapeForLayout(theme.shape, template) } };
}

/** The words for a variant's choices, for its default name: "Wall of love, Dark cinema". */
export function describeStyleVariant(config: StyleVariantConfig, layoutName: (t: WidgetTemplate) => string): string {
  const parts = [config.template ? layoutName(config.template) : null, STYLE_PRESETS.find((p) => p.id === config.preset)?.name ?? null].filter(Boolean);
  return parts.length ? parts.join(", ") : "Current look";
}
