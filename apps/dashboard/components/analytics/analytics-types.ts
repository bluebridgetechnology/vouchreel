// Shapes and constants shared by the analytics screen and its parts.

export interface OverviewStats {
  impressions: number;
  plays: number;
  clicks: number;
  conversions: number;
}

export interface FunnelStep {
  step: string;
  count: number;
  dropOffPercent: number | null;
  conversionFromPrevious: number | null;
}

export interface PerTestimonialStats {
  testimonialId: string;
  title: string | null;
  customerName: string | null;
  thumbnailUrl: string | null;
  isActive: boolean | null;
  impressions: number;
  plays: number;
  clicks: number;
  conversions: number;
}

export interface ComparativeAnalyticsData {
  current: {
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  previous: {
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  deltas: {
    impressions: number;
    plays: number;
    clicks: number;
    conversions: number;
    playRate: number | null;
    conversionRate: number | null;
    funnel: Record<string, number>;
  };
}

export interface SegmentComparisonData {
  segment1: {
    filter: Record<string, unknown>;
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  segment2: {
    filter: Record<string, unknown>;
    stats: OverviewStats;
    funnel: FunnelStep[];
    playRate: number | null;
    conversionRate: number | null;
  };
  deltas: {
    impressions: number;
    plays: number;
    clicks: number;
    conversions: number;
    playRate: number | null;
    conversionRate: number | null;
    funnel: Record<string, number>;
  };
}

export type SortKey =
  | "title"
  | "impressions"
  | "plays"
  | "clicks"
  | "conversions";

export type CompareMode = "none" | "previous" | "segments";

export const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

export const STEP_LABELS: Record<string, string> = {
  impression: "Impressions",
  play: "Plays",
  click: "Clicks",
  convert: "Conversions",
};

export function rangeFor(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}
