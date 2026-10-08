/**
 * What the owner agrees to before a video is made from imported reviews. The reviewers cannot be
 * asked (the app has no way to contact them), so the record kept is the owner's confirmation:
 * which wording, who, when. Bump the version whenever the text changes so a stored confirmation can
 * always be matched to the exact wording the owner saw.
 */
export const REVIEW_RIGHTS_VERSION = "2026-10-v2";

export const REVIEW_RIGHTS_HEADLINE = "I have the right to use these reviews in my marketing.";

export const REVIEW_RIGHTS_DETAIL =
  "They are shown as written, with the reviewer's name, rating and source. A review that is longer than the template can show is cut at a word and ends with “…”; nothing is reworded.";

/**
 * Reviews the owner typed in themselves (from their own site, an email, a message). The owner is
 * also the one who vouches they are genuine, so the wording says so.
 */
export const REVIEW_RIGHTS_OWN_VERSION = "2026-10-own-v2";

export const REVIEW_RIGHTS_OWN_HEADLINE = "These are genuine reviews from real customers, and I have the right to use them in my marketing.";

export const REVIEW_RIGHTS_OWN_DETAIL =
  "They are shown as you entered them, with the name you gave. A review that is longer than the template can show is cut at a word and ends with “…”; nothing is reworded. Nothing is added: no rating, no logo, no date.";

/** The wording version recorded for a video, from the sources of the reviews in it. */
export function rightsVersionFor(sources: string[]): string {
  return sources.some((s) => s === "own") ? REVIEW_RIGHTS_OWN_VERSION : REVIEW_RIGHTS_VERSION;
}

export function isCurrentRightsVersion(version: string | null): boolean {
  return version === REVIEW_RIGHTS_VERSION || version === REVIEW_RIGHTS_OWN_VERSION;
}

export function rightsTextFor(sources: string[]): { headline: string; detail: string } {
  return sources.some((s) => s === "own")
    ? { headline: REVIEW_RIGHTS_OWN_HEADLINE, detail: REVIEW_RIGHTS_OWN_DETAIL }
    : { headline: REVIEW_RIGHTS_HEADLINE, detail: REVIEW_RIGHTS_DETAIL };
}
