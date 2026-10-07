import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Reviews imported from Google come through the Places API, which asks for the Google Maps logo or the
 * text "Google Maps" as the source. The widget has no image budget, so it uses the text. This fails if
 * the label changes without docs/gaps-register.md P3 being revisited.
 */
describe("review source attribution", () => {
  const source = readFileSync(path.join(import.meta.dirname, "..", "widget.ts"), "utf8");

  it("labels Google reviews 'Google Maps', and never 'Google Reviews'", () => {
    expect(source).toContain('review.provider === "google" ? "Google Maps"');
    expect(source).not.toContain("Google Reviews");
  });
});
