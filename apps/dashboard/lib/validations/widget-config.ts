import { z } from "zod";

export const WIDGET_POSITIONS = [
  "bottom-right",
  "bottom-left",
  "bottom-bar",
  "story-strip",
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

export const widgetThemeSchema = z.object({
  primaryColor: z
    .string()
    .trim()
    .regex(hexColorRegex, "Primary color must be a valid hex color (e.g. #6366f1)"),
  accentColor: z
    .string()
    .trim()
    .regex(hexColorRegex, "Accent color must be a valid hex color (e.g. #ffffff)"),
  mode: z.enum(THEME_MODES),
  borderRadius: z
    .number()
    .int("Border radius must be an integer")
    .min(0, "Border radius cannot be negative")
    .max(24, "Border radius cannot exceed 24px"),
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
export type WidgetTheme = z.infer<typeof widgetThemeSchema>;
export type TriggerType = z.infer<typeof triggerTypeSchema>;
export type TriggerValue = z.infer<typeof triggerValueSchema>;
export type UpdateWidgetConfigInput = z.infer<typeof updateWidgetConfigSchema>;

export interface WidgetConfigRecord {
  id: string;
  spaceId: string;
  position: WidgetPosition;
  theme: WidgetTheme;
  triggerType: TriggerType;
  triggerValue: Record<string, unknown>;
  pagesIncluded: string[];
  pagesExcluded: string[];
  autoplayPreview: boolean;
  createdAt: Date;
}

export const DEFAULT_WIDGET_CONFIG: Omit<WidgetConfigRecord, "id" | "spaceId" | "createdAt"> = {
  position: "bottom-right",
  theme: {
    primaryColor: "#6366f1",
    accentColor: "#ffffff",
    mode: "light",
    borderRadius: 12,
  },
  triggerType: "delay",
  triggerValue: { seconds: 5 },
  pagesIncluded: ["*"],
  pagesExcluded: [],
  autoplayPreview: true,
};
