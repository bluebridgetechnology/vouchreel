// Kept apart from retention.ts so the setting can be read (and tested) without a database connection.

/**
 * How long text fetched from Google or Trustpilot is kept. The hourly sync refreshes the text of every review the
 * provider still returns, so it only ages for reviews the provider stopped returning, or for a source whose sync
 * keeps failing. Videos made from a review keep the words they showed (that is the record of what was published),
 * so this does not touch them. Owner-typed reviews are the owner's own text and are never purged.
 *
 * Default 30 days. 0 turns the purge off. The right number depends on the providers' terms (see the register, P4).
 */
export const DEFAULT_REVIEW_TEXT_RETENTION_DAYS = 30;

export function reviewTextRetentionDays(value = process.env.REVIEW_TEXT_RETENTION_DAYS): number {
  if (value === undefined || value.trim() === "") return DEFAULT_REVIEW_TEXT_RETENTION_DAYS;
  const days = Number(value);
  return Number.isFinite(days) && days >= 0 ? Math.floor(days) : DEFAULT_REVIEW_TEXT_RETENTION_DAYS;
}
