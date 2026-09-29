import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((v) => !isNaN(Date.parse(v)), "Invalid date");

export const analyticsQuerySchema = z.object({
  type: z.enum(["overview", "testimonials", "timeseries", "funnel"]).default("overview"),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  interval: z.enum(["day", "week"]).default("day"),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

/** Resolves the query params into a concrete date range; defaults to last 30 days. */
export function resolveDateRange(query: AnalyticsQuery): { start: Date; end: Date } {
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
