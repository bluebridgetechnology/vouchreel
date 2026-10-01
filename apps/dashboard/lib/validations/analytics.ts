import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((v) => !isNaN(Date.parse(v)), "Invalid date");

export const analyticsQuerySchema = z.object({
  type: z
    .enum([
      "overview",
      "testimonials",
      "timeseries",
      "funnel",
      "comparison",
      "segment-comparison",
      "filter-options",
    ])
    .default("overview"),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  interval: z.enum(["day", "week"]).default("day"),
  testimonialId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  pageUrl: z.string().optional().or(z.literal("").transform(() => undefined)),
  deviceType: z
    .enum(["mobile", "desktop"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  trafficSource: z.string().optional().or(z.literal("").transform(() => undefined)),
  experimentId: z.string().optional().or(z.literal("").transform(() => undefined)),
  variantIndex: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }, z.number().int().optional()),
  compareRange: z
    .union([z.boolean(), z.enum(["true", "false", "previous"])])
    .transform((val) => val === true || val === "true" || val === "previous")
    .optional(),
  compareSegment: z.string().optional().or(z.literal("").transform(() => undefined)),
  prevStartDate: isoDate.optional(),
  prevEndDate: isoDate.optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const analyticsExportQuerySchema = z.object({
  format: z.enum(["csv"]).default("csv"),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  testimonialId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  pageUrl: z.string().optional().or(z.literal("").transform(() => undefined)),
  deviceType: z
    .enum(["mobile", "desktop"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  trafficSource: z.string().optional().or(z.literal("").transform(() => undefined)),
  experimentId: z.string().optional().or(z.literal("").transform(() => undefined)),
  variantIndex: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }, z.number().int().optional()),
});

export type AnalyticsExportQuery = z.infer<typeof analyticsExportQuerySchema>;

export const analyticsReportQuerySchema = z.object({
  format: z.enum(["pdf", "html"]).default("pdf"),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  brandName: z.string().optional().or(z.literal("").transform(() => undefined)),
  logoUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  brandColor: z.string().optional().or(z.literal("").transform(() => undefined)),
});

export type AnalyticsReportQuery = z.infer<typeof analyticsReportQuerySchema>;

/** Resolves the query params into a concrete date range; defaults to last 30 days. */
export function resolveDateRange(query: {
  startDate?: string;
  endDate?: string;
}): { start: Date; end: Date } {
  if (query.startDate && query.endDate) {
    return {
      start: new Date(`${query.startDate}T00:00:00.000Z`),
      end: new Date(`${query.endDate}T23:59:59.999Z`),
    };
  }
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { start, end };
}

/** Resolves the previous date range for comparisons */
export function resolvePreviousDateRange(
  currentRange: { start: Date; end: Date },
  prev?: { prevStartDate?: string; prevEndDate?: string }
): { start: Date; end: Date } {
  if (prev?.prevStartDate && prev?.prevEndDate) {
    return {
      start: new Date(`${prev.prevStartDate}T00:00:00.000Z`),
      end: new Date(`${prev.prevEndDate}T23:59:59.999Z`),
    };
  }
  const durationMs = currentRange.end.getTime() - currentRange.start.getTime();
  const prevEnd = new Date(currentRange.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: prevStart, end: prevEnd };
}
