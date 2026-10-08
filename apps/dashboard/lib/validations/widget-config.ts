import { z } from "zod";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";

export const WIDGET_POSITIONS = [
  "bottom-right",
  "bottom-left",
  "bottom-bar",
  "story-strip",
] as const;

export const WIDGET_TEMPLATES = [
  "wall-of-love",
  "carousel",
  "story-strip",
  "floating-card",
  "masonry",
] as const;

export const TRIGGER_TYPES = [
  "delay",
  "exit-intent",
  "scroll-depth",
  "pageview-count",
  "returning-visitor",
] as const;

export const THEME_MODES = ["light", "dark"] as const;

const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const widgetPositionSchema = z.enum(WIDGET_POSITIONS);
export const widgetTemplateSchema = z.enum(WIDGET_TEMPLATES);

/** Media frame of each item. Null means the layout's own default. */
export const WIDGET_SHAPES = ["circle", "square", "rounded", "landscape", "portrait", "vertical"] as const;
export const WIDGET_SIZES = ["sm", "md", "lg"] as const;
export const WIDGET_SHADOWS = ["none", "soft", "strong"] as const;
export const PLAY_BUTTON_STYLES = ["circle", "solid", "minimal"] as const;
export const WIDGET_ENTRANCES = ["none", "fade", "slide", "pop"] as const;
export const WIDGET_GAPS = ["tight", "normal", "loose"] as const;

const hexColor = (label: string) =>
  z.string().trim().regex(hexColorRegex, `${label} must be a valid hex color (e.g. #cf3d0b)`);

/**
 * Widget appearance. Stored in `widget_configs.theme` (jsonb), so adding a field needs no migration.
 * The first four fields are the original theme; everything after them is optional and filled with
 * defaults by `normalizeTheme`, so themes saved before these fields existed look exactly as they did.
 * A saved brand kit still overrides colours, radius and fonts (lib/brand-kit/theme.ts).
 */
export const widgetThemeSchema = z.object({
  primaryColor: hexColor("Primary color"),
  accentColor: hexColor("Accent color"),
  mode: z.enum(THEME_MODES),
  borderRadius: z
    .number()
    .int("Border radius must be an integer")
    .min(0, "Border radius cannot be negative")
    .max(48, "Border radius cannot exceed 48px"),

  /** Surface colour of cards and dialogs; null follows light/dark mode. */
  background: hexColor("Background color").nullable().optional(),
  /** Text colour; null follows light/dark mode. */
  textColor: hexColor("Text color").nullable().optional(),
  shape: z.enum(WIDGET_SHAPES).nullable().optional(),
  size: z.enum(WIDGET_SIZES).optional(),
  shadow: z.enum(WIDGET_SHADOWS).optional(),
  borderWidth: z.number().int().min(0).max(4).optional(),
  /** Border colour; null uses the mode's subtle border. */
  borderColor: hexColor("Border color").nullable().optional(),
  /** Frosted, translucent surfaces. */
  glass: z.boolean().optional(),
  showName: z.boolean().optional(),
  showCompany: z.boolean().optional(),
  showStars: z.boolean().optional(),
  showSource: z.boolean().optional(),
  showQuote: z.boolean().optional(),
  playButtonStyle: z.enum(PLAY_BUTTON_STYLES).optional(),
  /** Maximum columns for grid layouts; fewer on narrow screens. */
  columns: z.number().int().min(1).max(4).optional(),
  gap: z.enum(WIDGET_GAPS).optional(),
  /** Seconds between automatic advances in carousel-style layouts; 0 turns it off. */
  autoAdvance: z.number().int().min(0).max(30).optional(),
  /** Always off for visitors who ask for reduced motion. */
  entrance: z.enum(WIDGET_ENTRANCES).optional(),
});

export const triggerTypeSchema = z.enum(TRIGGER_TYPES);

export const triggerValueSchema = z
  .record(z.string(), z.unknown())
  .superRefine((val, ctx) => {
    if ("seconds" in val && val.seconds !== undefined) {
      const sec = Number(val.seconds);
      if (isNaN(sec) || sec < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Delay must be at least 1 second",
          path: ["seconds"],
        });
      }
    }
    if ("percentage" in val && val.percentage !== undefined) {
      const pct = Number(val.percentage);
      if (isNaN(pct) || pct < 1 || pct > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Scroll percentage must be between 1 and 100",
          path: ["percentage"],
        });
      }
    }
    if ("count" in val && val.count !== undefined) {
      const cnt = Number(val.count);
      if (isNaN(cnt) || cnt < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pageview count must be at least 1",
          path: ["count"],
        });
      }
    }
  });

export const updateWidgetConfigSchema = z.object({
  template: widgetTemplateSchema.default("floating-card"),
  position: widgetPositionSchema,
  theme: widgetThemeSchema,
  triggerType: triggerTypeSchema,
  triggerValue: triggerValueSchema,
  pagesIncluded: z
    .array(z.string().trim().min(1, "Pattern cannot be empty"))
    .default(["*"]),
  pagesExcluded: z
    .array(z.string().trim().min(1, "Pattern cannot be empty"))
    .default([]),
  autoplayPreview: z.boolean().default(true),
});

export type WidgetPosition = z.infer<typeof widgetPositionSchema>;
export type WidgetTemplate = z.infer<typeof widgetTemplateSchema>;
export type WidgetTheme = z.infer<typeof widgetThemeSchema>;
export type TriggerType = z.infer<typeof triggerTypeSchema>;
export type TriggerValue = z.infer<typeof triggerValueSchema>;
export type UpdateWidgetConfigInput = z.infer<typeof updateWidgetConfigSchema>;

export interface WidgetConfigRecord {
  id: string;
  spaceId: string;
  template: WidgetTemplate;
  position: WidgetPosition;
  theme: WidgetTheme;
  triggerType: TriggerType;
  triggerValue: Record<string, unknown>;
  pagesIncluded: string[];
  pagesExcluded: string[];
  autoplayPreview: boolean;
  createdAt: Date;
}

/** Every theme field with the value that reproduces the widget's original look. */
export const DEFAULT_WIDGET_THEME: Required<WidgetTheme> = {
  primaryColor: DEFAULT_BRAND_HEX,
  accentColor: "#ffffff",
  mode: "light",
  borderRadius: 12,
  background: null,
  textColor: null,
  shape: null,
  size: "md",
  shadow: "soft",
  borderWidth: 1,
  borderColor: null,
  glass: false,
  showName: true,
  showCompany: true,
  showStars: true,
  showSource: true,
  showQuote: true,
  playButtonStyle: "circle",
  columns: 3,
  gap: "normal",
  autoAdvance: 0,
  entrance: "slide",
};

/**
 * A stored theme (possibly from before the newer fields existed, possibly hand-edited) as a complete,
 * valid theme: unknown keys dropped, invalid or missing values replaced by defaults, field by field,
 * so one bad value never throws away the rest of the owner's choices.
 */
export function normalizeTheme(raw: unknown): Required<WidgetTheme> {
  const out: Record<string, unknown> = { ...DEFAULT_WIDGET_THEME };
  if (!raw || typeof raw !== "object") return out as Required<WidgetTheme>;
  const shape = widgetThemeSchema.shape;
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === undefined) continue;
    const parsed = shape[key].safeParse(value);
    if (parsed.success && parsed.data !== undefined) out[key] = parsed.data;
  }
  return out as Required<WidgetTheme>;
}

export const DEFAULT_WIDGET_CONFIG: Omit<WidgetConfigRecord, "id" | "spaceId" | "createdAt"> = {
  template: "floating-card",
  position: "bottom-right",
  theme: DEFAULT_WIDGET_THEME,
  triggerType: "delay",
  triggerValue: { seconds: 5 },
  pagesIncluded: ["*"],
  pagesExcluded: [],
  autoplayPreview: true,
};
