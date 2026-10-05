export type ReviewSource = "google" | "trustpilot";
export type Aspect = "9:16" | "16:9";

/** One review exactly as the provider returned it. Text is never edited by templates. */
export interface VideoReview {
  author: string;
  /** Whole stars, 1 to 5. */
  rating: number;
  text: string;
  /** Pre-formatted, e.g. "March 2026". Optional. */
  date?: string;
  source: ReviewSource;
}

/** Provider-reported totals ("4.8 from 213 reviews"), never computed from a subset. */
export interface VideoAggregate {
  source: ReviewSource;
  /** 0 to 5, one decimal is plenty. */
  rating: number;
  total: number;
}

export interface ReviewVideoProps {
  reviews: VideoReview[];
  /** Hex colour like #cf3d0b. */
  brand: string;
  aggregate?: VideoAggregate;
}

export const SOURCE_LABELS: Record<ReviewSource, string> = {
  google: "Google Reviews",
  trustpilot: "Trustpilot",
};

export const ASPECTS: Record<Aspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

export const FPS = 30;
