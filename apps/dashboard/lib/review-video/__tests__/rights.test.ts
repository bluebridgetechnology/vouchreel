import { describe, expect, it } from "vitest";
import { REVIEW_RIGHTS_DETAIL, REVIEW_RIGHTS_HEADLINE, REVIEW_RIGHTS_VERSION } from "../rights";

describe("review video rights wording", () => {
  it("has a version and the text the owner agrees to", () => {
    expect(REVIEW_RIGHTS_VERSION).toMatch(/^\d{4}-\d{2}-v\d+$/);
    expect(REVIEW_RIGHTS_HEADLINE).toMatch(/right to use these reviews/i);
    expect(REVIEW_RIGHTS_DETAIL).toMatch(/shown as written/i);
    expect(REVIEW_RIGHTS_DETAIL).toMatch(/cut at a word.*….*nothing is reworded/i); // the owner is told about the cut before confirming
    expect(REVIEW_RIGHTS_VERSION).toBe("2026-10-v2"); // the wording changed, so the version did
  });
});

describe("rights wording for reviews the owner typed in", () => {
  it("uses its own wording and version when any picked review is owner-supplied", async () => {
    const r = await import("../rights");
    expect(r.rightsVersionFor(["google", "own"])).toBe(r.REVIEW_RIGHTS_OWN_VERSION);
    expect(r.rightsVersionFor(["google", "trustpilot"])).toBe(r.REVIEW_RIGHTS_VERSION);
    expect(r.rightsTextFor(["own"]).headline).toMatch(/genuine reviews from real customers/i);
    expect(r.rightsTextFor(["google"]).headline).toBe(r.REVIEW_RIGHTS_HEADLINE);
    expect(r.isCurrentRightsVersion(r.REVIEW_RIGHTS_OWN_VERSION)).toBe(true);
    expect(r.isCurrentRightsVersion("2026-01-v0")).toBe(false);
    expect(r.isCurrentRightsVersion(null)).toBe(false);
  });
});
