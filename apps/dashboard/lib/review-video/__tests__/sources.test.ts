import { describe, expect, it } from "vitest";
import { enabledReviewVideoSources, sourceBlockedReason } from "../sources";

describe("which review sources may become videos", () => {
  it("is own reviews only until Google and Trustpilot are switched on", () => {
    const before = process.env.REVIEW_VIDEO_SOURCES; // the test setup switches everything on, so look at the real default
    delete process.env.REVIEW_VIDEO_SOURCES;
    try {
      expect(enabledReviewVideoSources()).toEqual(["own"]);
    } finally {
      if (before !== undefined) process.env.REVIEW_VIDEO_SOURCES = before;
    }
    expect(enabledReviewVideoSources("")).toEqual(["own"]);
    expect(enabledReviewVideoSources("  ")).toEqual(["own"]);
  });

  it("reads a comma-separated list, ignoring case, spaces and unknown names", () => {
    expect(enabledReviewVideoSources("google, Trustpilot ,own")).toEqual(["google", "trustpilot", "own"]);
    expect(enabledReviewVideoSources("trustpilot")).toEqual(["trustpilot"]);
    expect(enabledReviewVideoSources("yelp,google")).toEqual(["google"]);
    expect(enabledReviewVideoSources("yelp")).toEqual([]);
  });

  it("explains what is off and what to do instead", () => {
    expect(sourceBlockedReason("google", ["own"])).toMatch(/Google reviews are not switched on yet.*add a review of your own/i);
    expect(sourceBlockedReason("trustpilot", ["own"])).toMatch(/Trustpilot/);
    expect(sourceBlockedReason("own", ["own"])).toBeNull();
    expect(sourceBlockedReason("google", ["google"])).toBeNull();
  });
});
