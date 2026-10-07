import { durationInFrames, getTemplate, maxCharsFor, reviewFits, type ReviewVideoProps, type VideoFontId } from "@vouchreel/video";

/** Shapes the review-videos API returns (JSON), shared by the owner UI and its tests. */
export interface ReviewOptionView {
  id: string;
  author: string;
  rating: number | null;
  text: string;
  source: "google" | "trustpilot" | "own";
  link?: string | null;
  date: string | null;
  fits: string[];
}

export interface SourceStatsView {
  source: "google" | "trustpilot";
  rating: number;
  total: number;
}

export interface TemplateView {
  id: string;
  label: string;
  description: string;
  reviews: { min: number; max: number };
  requiresAggregate: boolean;
  maxChars: number;
}

export type ReviewVideoStatus = "queued" | "rendering" | "done" | "failed";

export interface ReviewVideoView {
  id: string;
  template: string;
  aspect: "9:16" | "16:9";
  status: ReviewVideoStatus;
  outputUrl: string | null;
  durationSeconds: number | null;
  error: string | null;
  createdAt: string;
  reviewIds: string[];
  /** Shown in the owner's embedded widget. */
  showInWidget?: boolean;
  /** Set when a platform administrator took the video down; its file is gone. */
  moderatedAt?: string | null;
  moderationReason?: string | null;
}

export const STATUS_LABELS: Record<ReviewVideoStatus, string> = {
  queued: "In the queue",
  rendering: "Creating",
  done: "Ready",
  failed: "Failed",
};

export const isInFlight = (status: ReviewVideoStatus) => status === "queued" || status === "rendering";
export const shouldPoll = (videos: Pick<ReviewVideoView, "status">[]) => videos.some((v) => isInFlight(v.status));

/**
 * Whether a review fits a template in the chosen font. With no font the server's answer (`fits`) is used;
 * a wider or narrower font changes how much fits, so then it is worked out from the text with the same
 * rule. Reviews are never shortened.
 */
export function fitsTemplate(review: Pick<ReviewOptionView, "text" | "fits">, template: Pick<TemplateView, "id" | "maxChars">, font?: VideoFontId | null): boolean {
  if (!font) return review.fits.includes(template.id);
  const length = review.text.trim().length;
  return length >= 12 && length <= maxCharsFor(template.maxChars, font);
}

/** Why a template cannot be used right now, or null when it can. */
export function templateBlockedReason(template: TemplateView, stats: SourceStatsView[], reviews: ReviewOptionView[], font?: VideoFontId | null): string | null {
  if (template.requiresAggregate && stats.length === 0) {
    return "Needs your overall rating and review count. It appears after your next review sync.";
  }
  if (!reviews.some((r) => fitsTemplate(r, template, font))) return "None of your reviews fit this template (reviews are never shortened).";
  if (reviews.filter((r) => fitsTemplate(r, template, font)).length < template.reviews.min) {
    return `Needs at least ${template.reviews.min} suitable reviews.`;
  }
  return null;
}

/** Whether a review can be picked now, and why not. */
export function reviewPickState(
  review: ReviewOptionView,
  template: TemplateView,
  selected: string[],
  font?: VideoFontId | null
): { disabled: boolean; reason: string | null } {
  if (selected.includes(review.id)) return { disabled: false, reason: null };
  if (!fitsTemplate(review, template, font)) {
    return { disabled: true, reason: `Too long for ${template.label}${font ? " in this font" : ""} (max ${maxCharsFor(template.maxChars, font)} characters)` };
  }
  // A single-review template swaps the pick instead of blocking
  if (template.reviews.max > 1 && selected.length >= template.reviews.max) {
    return { disabled: true, reason: `${template.label} shows at most ${template.reviews.max} reviews` };
  }
  return { disabled: false, reason: null };
}

/** New selection after clicking a review: toggles, and replaces the pick for single-review templates. */
export function toggleSelection(selected: string[], id: string, template: TemplateView): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  if (template.reviews.max === 1) return [id];
  return selected.length >= template.reviews.max ? selected : [...selected, id];
}

/** Keeps only picks that still fit after the template changed. */
export function pruneSelection(selected: string[], template: TemplateView, reviews: ReviewOptionView[], font?: VideoFontId | null): string[] {
  const valid = selected.filter((id) => {
    const review = reviews.find((r) => r.id === id);
    return review ? fitsTemplate(review, template, font) : false;
  });
  return valid.slice(0, template.reviews.max);
}

export interface SelectionCheck {
  ready: boolean;
  /** What is still needed, in plain words. */
  message: string;
}

export function checkSelection(template: TemplateView, selected: string[], rightsConfirmed: boolean): SelectionCheck {
  const { min, max } = template.reviews;
  if (selected.length < min) {
    return { ready: false, message: min === 1 ? "Pick a review." : `Pick at least ${min} reviews (${selected.length} so far).` };
  }
  if (selected.length > max) return { ready: false, message: `Pick at most ${max} reviews.` };
  if (!rightsConfirmed) return { ready: false, message: "Confirm you may use these reviews to continue." };
  return { ready: true, message: "" };
}

/** Rough length of the finished video, from the same maths the renderer uses. */
export function estimateSeconds(template: TemplateView, picked: ReviewOptionView[], stats: SourceStatsView[]): number | null {
  const info = getTemplate(template.id);
  if (!info || picked.length < template.reviews.min) return null;
  const props: ReviewVideoProps = {
    brand: "#000000",
    reviews: picked.map((r) => ({ author: r.author, rating: r.rating, text: r.text, source: r.source, ...(r.link ? { link: r.link } : {}) })),
    ...(stats[0] ? { aggregate: stats[0] } : {}),
  };
  return durationInFrames(template.id, props) / 30;
}

/**
 * Player source that opens on a meaningful frame. Every template animates in from nothing, so
 * frame 0 is blank; a media fragment makes the browser show a later frame until the user presses play.
 */
export function posterSrc(url: string, durationSeconds: number | null): string {
  const at = durationSeconds && durationSeconds > 3 ? Math.max(2, Math.floor(durationSeconds * 0.6)) : 2;
  return `${url}#t=${at}`;
}

/** Re-exported so the UI and tests use the same fit rule as the server. */
export { reviewFits };
