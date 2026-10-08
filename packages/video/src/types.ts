import type { VideoFontId } from "./lib/font-catalog";

/** `own` is a review the owner typed in themselves: no provider, no logo, no rating. */
export type ReviewSource = "google" | "trustpilot" | "own";
export type Aspect = "9:16" | "16:9";

/** One review as the provider returned it. Templates never edit the text; a review too long for a template is cut before it gets here (see `shortenReviewText`). */
export interface VideoReview {
  author: string;
  /** Whole stars, 1 to 5. Null for an owner-supplied review, which has no rating (no stars are drawn). */
  rating: number | null;
  text: string;
  /** Set when `text` is a cut-down copy: the length of the full review. The templates draw `text` as it is. */
  shortenedFrom?: number;
  /** Pre-formatted, e.g. "March 2026". Optional. */
  date?: string;
  source: ReviewSource;
  /** Owner-supplied reviews only: the site the review came from, shown as its domain ("example.com"). */
  link?: string;
}

/** Provider-reported totals ("4.8 from 213 reviews"), never computed from a subset. */
export interface VideoAggregate {
  source: ReviewSource;
  /** 0 to 5, one decimal is plenty. */
  rating: number;
  total: number;
}

/**
 * Background styles. A style only decides how the background looks; every colour in it is derived
 * from the brand colour, so any colour works with any style.
 */
export type BackgroundStyle = "gradient" | "solid" | "aurora" | "dots" | "light" | "dark";

export const BACKGROUND_STYLES: BackgroundStyle[] = ["gradient", "solid", "aurora", "dots", "light", "dark"];

export interface VideoTheme {
  /** Font for the review text. When omitted the template uses its own typography (Outfit, Playfair quotes in Minimal). */
  font?: VideoFontId;
  /** Background style. When omitted the template uses its own default. */
  style?: BackgroundStyle;
  /** Optional second colour: the far end of the gradient (colour styles only). */
  secondary?: string;
}

export interface ReviewVideoProps {
  reviews: VideoReview[];
  /** Hex colour like #cf3d0b. */
  brand: string;
  aggregate?: VideoAggregate;
  theme?: VideoTheme;
}

export const SOURCE_LABELS: Record<ReviewSource, string> = {
  /** Reviews come from the Google Places API, whose attribution rule (as last read, not confirmed against the policy page) is the Google Maps logo or the text "Google Maps". See docs/gaps-register.md P3. */
  google: "Google Maps",
  trustpilot: "Trustpilot",
  /** Nothing: an owner-supplied review claims no outside source. */
  own: "",
};

export const ASPECTS: Record<Aspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

export const FPS = 30;
