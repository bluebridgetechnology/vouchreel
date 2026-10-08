/**
 * Cutting a review that is longer than a template can show. The review itself is never changed: only the
 * copy that goes into the video is cut, at a word boundary, and marked with an ellipsis. Pure and free of
 * Remotion/React, because the dashboard preview uses it in the browser too.
 */

export const ELLIPSIS = "…";

/** The shortest review worth a video; below this nothing is made, cut or not. */
export const MIN_REVIEW_CHARS = 12;

export interface ShortenResult {
  /** What the video shows. Equal to the trimmed input when it already fits. */
  text: string;
  shortened: boolean;
  /** Length of the trimmed original, so the video record shows how much was left out. */
  originalLength: number;
}

/**
 * Fits `text` into `limit` characters (the ellipsis counts). Text that already fits is returned as it is.
 * Longer text is cut at the last whole word that leaves room for the ellipsis; trailing spaces and
 * dangling punctuation before the ellipsis are dropped so it reads "…and then we…", not "…and then we, …".
 * One unbroken run longer than the limit (no spaces) is cut at the limit.
 */
export function shortenReviewText(text: string, limit: number): ShortenResult {
  const full = text.trim();
  if (full.length <= limit) return { text: full, shortened: false, originalLength: full.length };

  const room = Math.max(1, limit - ELLIPSIS.length);
  const head = full.slice(0, room + 1); // one extra character to see whether the cut falls between words
  let cut: string;
  if (/\s/.test(head[room] ?? "")) {
    cut = full.slice(0, room);
  } else {
    const lastSpace = full.slice(0, room).search(/\s\S*$/);
    cut = lastSpace > 0 ? full.slice(0, lastSpace) : full.slice(0, room);
  }
  cut = cut.replace(/[\s,;:\-–—(]+$/u, "");
  return { text: cut + ELLIPSIS, shortened: true, originalLength: full.length };
}

/**
 * Which review sources may be shortened. One place to switch a source back to "must fit whole" if its
 * terms ever turn out to forbid cutting (the review text is then rejected as too long, as before).
 */
export const SHORTENABLE_SOURCES: Record<"google" | "trustpilot" | "own", boolean> = {
  google: true,
  trustpilot: true,
  own: true,
};
