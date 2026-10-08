/**
 * Which kinds of review a video may be made from. Videos from Google and Trustpilot reviews depend on those
 * providers' terms, which nobody has read yet (register P4), so they are off unless REVIEW_VIDEO_SOURCES lists
 * them: a comma-separated list of `google`, `trustpilot` and `own`. Reviews the owner typed in (`own`) are the
 * owner's own words and are on by default.
 *
 *   REVIEW_VIDEO_SOURCES=google,trustpilot,own   everything on
 *   (unset)                                      own only
 */

export type ReviewVideoSource = "google" | "trustpilot" | "own";

export const REVIEW_VIDEO_SOURCES: readonly ReviewVideoSource[] = ["google", "trustpilot", "own"];

export const SOURCE_LABELS: Record<ReviewVideoSource, string> = { google: "Google", trustpilot: "Trustpilot", own: "your own" };

export function enabledReviewVideoSources(value = process.env.REVIEW_VIDEO_SOURCES): ReviewVideoSource[] {
  if (value === undefined || value.trim() === "") return ["own"];
  const wanted = value.split(",").map((s) => s.trim().toLowerCase());
  return REVIEW_VIDEO_SOURCES.filter((s) => wanted.includes(s));
}

/** Why a video cannot be made from a review of this source, or null when it can. */
export function sourceBlockedReason(source: ReviewVideoSource, enabled = enabledReviewVideoSources()): string | null {
  if (enabled.includes(source)) return null;
  return `Videos from ${SOURCE_LABELS[source]} reviews are not switched on yet. You can add a review of your own instead.`;
}
