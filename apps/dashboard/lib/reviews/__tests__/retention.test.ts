import { describe, expect, it } from "vitest";
import { DEFAULT_REVIEW_TEXT_RETENTION_DAYS, reviewTextRetentionDays } from "../retention-config";

describe("review text retention setting", () => {
  it("defaults to 30 days", () => {
    expect(DEFAULT_REVIEW_TEXT_RETENTION_DAYS).toBe(30);
    expect(reviewTextRetentionDays(undefined)).toBe(30);
    expect(reviewTextRetentionDays("")).toBe(30);
  });
  it("takes a whole number of days, 0 to switch the purge off, and ignores nonsense", () => {
    expect(reviewTextRetentionDays("7")).toBe(7);
    expect(reviewTextRetentionDays("0")).toBe(0);
    expect(reviewTextRetentionDays("12.9")).toBe(12);
    expect(reviewTextRetentionDays("-3")).toBe(30);
    expect(reviewTextRetentionDays("soon")).toBe(30);
  });
});
