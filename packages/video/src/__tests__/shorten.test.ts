import { describe, expect, it } from "vitest";
import { ELLIPSIS, SHORTENABLE_SOURCES, TEMPLATES, maxCharsFor, reviewForTemplate, reviewUsable, shortenReviewText, validateProps, VIDEO_FONTS, type ReviewVideoProps } from "../registry";

const long = "The team answered within minutes, fixed the problem the same day, and followed up a week later to check that everything still worked. ".repeat(6).trim();

describe("shortenReviewText", () => {
  it("leaves a review that fits exactly as it is (apart from surrounding spaces)", () => {
    expect(shortenReviewText("  Great service, would recommend.  ", 400)).toEqual({ text: "Great service, would recommend.", shortened: false, originalLength: 31 });
    const exact = "x ".repeat(99) + "x"; // 199 characters
    expect(shortenReviewText(exact, 199).shortened).toBe(false);
  });

  it("cuts at a whole word, ends with an ellipsis, and never exceeds the limit", () => {
    for (const limit of [60, 120, 240, 320, 400]) {
      const r = shortenReviewText(long, limit);
      expect(r.shortened).toBe(true);
      expect(r.text.length).toBeLessThanOrEqual(limit);
      expect(r.text.endsWith(ELLIPSIS)).toBe(true);
      // what is kept is a prefix of the review made of whole words
      const kept = r.text.slice(0, -1);
      expect(long.startsWith(kept)).toBe(true);
      expect(/\s/.test(long[kept.length] ?? "")).toBe(true);
      expect(r.originalLength).toBe(long.length);
    }
  });

  it("fills the limit instead of stopping at the first sentence", () => {
    const r = shortenReviewText(long, 240);
    expect(r.text.length).toBeGreaterThan(240 - 20);
  });

  it("drops dangling punctuation before the ellipsis", () => {
    const r = shortenReviewText("Absolutely wonderful, truly, deeply, and sincerely recommended by everyone we know", 40);
    expect(r.text).not.toMatch(/[,;:\-–—]\s*…$/);
    expect(r.text.endsWith(ELLIPSIS)).toBe(true);
  });

  it("cuts a single unbroken run at the limit", () => {
    const r = shortenReviewText("x".repeat(500), 100);
    expect(r.text).toBe("x".repeat(99) + ELLIPSIS);
  });

  it("does not split an emoji or accented letter in two", () => {
    const r = shortenReviewText("Très bien ".repeat(80), 55);
    expect(r.text.slice(0, -1).length).toBeGreaterThan(0);
    expect(r.text).not.toMatch(/�/);
  });

  it("is deterministic", () => {
    expect(shortenReviewText(long, 240)).toEqual(shortenReviewText(long, 240));
  });
});

describe("cutting for every template and font", () => {
  it("a cut review always passes validation, for each template and font", () => {
    for (const template of TEMPLATES) {
      for (const font of [undefined, ...VIDEO_FONTS.map((f) => f.id)]) {
        const cut = reviewForTemplate(template, { text: long, source: "google" }, font);
        expect(cut.shortened).toBe(true);
        expect(cut.text.length).toBeLessThanOrEqual(maxCharsFor(template.maxChars, font));
        const n = template.reviews.min;
        const props: ReviewVideoProps = {
          brand: "#cf3d0b",
          reviews: Array.from({ length: n }, () => ({ author: "A", rating: 5, text: cut.text, source: "google" as const })),
          ...(template.requiresAggregate ? { aggregate: { source: "google" as const, rating: 4.8, total: 12 } } : {}),
          ...(font ? { theme: { font } } : {}),
        };
        expect(validateProps(template.id, props), `${template.id} / ${font ?? "default"}`).toEqual([]);
      }
    }
  });

  it("a review that fits is not touched", () => {
    const short = "A short and sweet review that fits everywhere.";
    for (const template of TEMPLATES) {
      expect(reviewForTemplate(template, { text: short, source: "trustpilot" })).toEqual({ text: short, shortened: false, originalLength: short.length });
    }
  });
});

describe("which reviews are usable", () => {
  const spotlight = TEMPLATES[0];
  it("a long review is usable while its source may be cut, and refused once the source is switched off", () => {
    expect(reviewUsable(spotlight, { text: long, source: "google" })).toBe(true);
    SHORTENABLE_SOURCES.google = false;
    try {
      expect(reviewUsable(spotlight, { text: long, source: "google" })).toBe(false);
      expect(reviewForTemplate(spotlight, { text: long, source: "google" }).shortened).toBe(false);
      expect(reviewUsable(spotlight, { text: long, source: "trustpilot" })).toBe(true);
    } finally {
      SHORTENABLE_SOURCES.google = true;
    }
  });
  it("a review under 12 characters is never usable", () => {
    expect(reviewUsable(spotlight, { text: "ok", source: "own" })).toBe(false);
  });
});
