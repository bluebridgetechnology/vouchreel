import { z } from "zod";

/** Longest review text accepted; the video templates have their own, tighter limits. */
export const OWN_REVIEW_MAX_TEXT = 1000;
export const OWN_REVIEW_MIN_TEXT = 12;
/** Most owner-supplied reviews one space can hold. */
export const OWN_REVIEW_LIMIT_PER_SPACE = 200;

export const ownReviewSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  text: z
    .string()
    .trim()
    .min(OWN_REVIEW_MIN_TEXT, `The review must be at least ${OWN_REVIEW_MIN_TEXT} characters`)
    .max(OWN_REVIEW_MAX_TEXT, `The review must be at most ${OWN_REVIEW_MAX_TEXT} characters`),
  /** Optional: where the review was published. Only https links are kept. */
  link: z
    .string()
    .trim()
    .max(500, "The link is too long")
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || isHttpsUrl(v), "The link must start with https://"),
});

export type OwnReviewInput = z.infer<typeof ownReviewSchema>;

function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** "https://www.example.com/a/b" becomes "example.com": what is shown with the review. */
export function linkDomain(link: string | null | undefined): string | undefined {
  if (!link) return undefined;
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
