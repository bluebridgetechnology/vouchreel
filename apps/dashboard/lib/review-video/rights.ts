/**
 * What the owner agrees to before a video is made from imported reviews. The reviewers cannot be
 * asked (the app has no way to contact them), so the record kept is the owner's confirmation:
 * which wording, who, when. Bump the version whenever the text changes so a stored confirmation can
 * always be matched to the exact wording the owner saw.
 */
export const REVIEW_RIGHTS_VERSION = "2026-10-v1";

export const REVIEW_RIGHTS_HEADLINE = "I have the right to use these reviews in my marketing.";

export const REVIEW_RIGHTS_DETAIL =
  "They are shown exactly as written, with the reviewer's name, rating and source, and are not edited or shortened.";
