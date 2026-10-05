import { durationInFrames, getTemplate, reviewFits, type ReviewVideoProps } from "@vouchreel/video";

/** Shapes the review-videos API returns (JSON), shared by the owner UI and its tests. */
export interface ReviewOptionView {
  id: string;
  author: string;
  rating: number;
  text: string;
  source: "google" | "trustpilot";
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
}

export const STATUS_LABELS: Record<ReviewVideoStatus, string> = {
  queued: "In the queue",
  rendering: "Creating",
  done: "Ready",
  failed: "Failed",
};

export const isInFlight = (status: ReviewVideoStatus) => status === "queued" || status === "rendering";
export const shouldPoll = (videos: Pick<ReviewVideoView, "status">[]) => videos.some((v) => isInFlight(v.status));

/** Why a template cannot be used right now, or null when it can. */
export function templateBlockedReason(template: TemplateView, stats: SourceStatsView[], reviews: ReviewOptionView[]): string | null {
  if (template.requiresAggregate && stats.length === 0) {
    return "Needs your overall rating and review count. It appears after your next review sync.";
  }
  if (!reviews.some((r) => r.fits.includes(template.id))) return "None of your reviews fit this template (reviews are never shortened).";
  if (reviews.filter((r) => r.fits.includes(template.id)).length < template.reviews.min) {
    return `Needs at least ${template.reviews.min} suitable reviews.`;
  }
  return null;
}

/** Whether a review can be picked now, and why not. */
export function reviewPickState(
  review: ReviewOptionView,
  template: TemplateView,
  selected: string[]
): { disabled: boolean; reason: string | null } {
  if (selected.includes(review.id)) return { disabled: false, reason: null };
  if (!review.fits.includes(template.id)) {
    return { disabled: true, reason: `Too long for ${template.label} (max ${template.maxChars} characters)` };
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
export function pruneSelection(selected: string[], template: TemplateView, reviews: ReviewOptionView[]): string[] {
  const valid = selected.filter((id) => reviews.find((r) => r.id === id)?.fits.includes(template.id));
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
    reviews: picked.map((r) => ({ author: r.author, rating: r.rating, text: r.text, source: r.source })),
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
