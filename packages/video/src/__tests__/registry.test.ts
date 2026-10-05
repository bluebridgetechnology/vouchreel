import { describe, expect, it } from "vitest";
import { STYLES, TEMPLATES, compositionId, durationInFrames, effectiveStyle, getTemplate, isBackgroundStyle, reviewFits, validateProps, type ReviewVideoProps } from "../registry";
import { BACKGROUND_STYLES } from "../types";
import { SAMPLE_PROPS } from "../sample";
import { TEMPLATE_COMPONENTS } from "../templates";

const review = (over: Partial<ReviewVideoProps["reviews"][number]> = {}) => ({
  author: "Maya Okafor",
  rating: 5,
  text: "Setup took ten minutes and support answered every question.",
  source: "google" as const,
  ...over,
});
const props = (n: number, extra: Partial<ReviewVideoProps> = {}): ReviewVideoProps => ({
  reviews: Array.from({ length: n }, () => review()),
  brand: "#cf3d0b",
  ...extra,
});

describe("template catalogue", () => {
  it("every template has a component, and every component has a template", () => {
    expect(Object.keys(TEMPLATE_COMPONENTS).sort()).toEqual(TEMPLATES.map((t) => t.id).sort());
  });

  it("every template has sample content that passes validation", () => {
    for (const template of TEMPLATES) {
      expect(validateProps(template.id, SAMPLE_PROPS[template.id]), template.id).toEqual([]);
    }
  });

  it("composition ids are unique per template and shape", () => {
    const ids = TEMPLATES.flatMap((t) => (["9:16", "16:9"] as const).map((a) => compositionId(t.id, a)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(compositionId("dark-card", "9:16")).toBe("dark-card-9x16");
  });

  it("video length stays social-sized, even for the longest allowed content", () => {
    for (const template of TEMPLATES) {
      const longest = "word ".repeat(Math.floor(template.maxChars / 5)).trim();
      const n = template.reviews.max;
      const content = props(n, {
        reviews: Array.from({ length: n }, () => review({ text: longest })),
        aggregate: { source: "google", rating: 4.8, total: 100 },
      });
      const seconds = durationInFrames(template.id, content) / 30;
      expect(seconds, template.id).toBeGreaterThan(5);
      expect(seconds, template.id).toBeLessThan(60);
    }
  });

  it("longer reviews make longer videos, and more reviews make a longer stack", () => {
    const short = durationInFrames("spotlight", props(1, { reviews: [review({ text: "Great service, would buy again." })] }));
    const long = durationInFrames("spotlight", props(1, { reviews: [review({ text: "word ".repeat(60).trim() })] }));
    expect(long).toBeGreaterThan(short);
    expect(durationInFrames("stack", props(5))).toBeGreaterThan(durationInFrames("stack", props(3)));
  });
});

describe("validateProps", () => {
  it("accepts good content for each template shape", () => {
    expect(validateProps("spotlight", props(1))).toEqual([]);
    expect(validateProps("stack", props(4))).toEqual([]);
    expect(validateProps("rating-spotlight", props(1, { aggregate: { source: "google", rating: 4.8, total: 213 } }))).toEqual([]);
  });

  it("rejects an unknown template and a bad brand colour", () => {
    expect(validateProps("nope", props(1))[0]).toMatch(/Unknown template/);
    expect(validateProps("spotlight", props(1, { brand: "red" }))[0]).toMatch(/hex colour/);
  });

  it("enforces how many reviews each template shows", () => {
    expect(validateProps("spotlight", props(0))[0]).toMatch(/needs 1 review/);
    expect(validateProps("spotlight", props(2))[0]).toMatch(/needs 1 review/);
    expect(validateProps("stack", props(2))[0]).toMatch(/3 to 5 reviews/);
    expect(validateProps("stack", props(6))[0]).toMatch(/3 to 5 reviews/);
  });

  it("never shortens reviews: text that does not fit is rejected, not trimmed", () => {
    const tooLong = props(1, { reviews: [review({ text: "x".repeat(401) })] });
    expect(validateProps("spotlight", tooLong).join(" ")).toMatch(/between 12 and 400 characters.*never shortened/);
    const stackTooLong = props(3, { reviews: Array.from({ length: 3 }, () => review({ text: "x".repeat(241) })) });
    expect(validateProps("stack", stackTooLong)[0]).toMatch(/240/);
    expect(validateProps("spotlight", props(1, { reviews: [review({ text: "ok" })] }))[0]).toMatch(/between 12/);
  });

  it("checks authors, ratings and sources", () => {
    expect(validateProps("spotlight", props(1, { reviews: [review({ author: "  " })] }))[0]).toMatch(/no author/);
    expect(validateProps("spotlight", props(1, { reviews: [review({ rating: 6 })] }))[0]).toMatch(/rating from 1 to 5/);
    expect(validateProps("spotlight", props(1, { reviews: [review({ rating: 3.5 })] }))[0]).toMatch(/rating from 1 to 5/);
    expect(validateProps("spotlight", props(1, { reviews: [review({ source: "yelp" as never })] }))[0]).toMatch(/unknown source/);
  });

  it("the rating template needs the provider totals", () => {
    expect(validateProps("rating-spotlight", props(1))[0]).toMatch(/overall rating and review count/);
    expect(validateProps("rating-spotlight", props(1, { aggregate: { source: "google", rating: 4.8, total: 0 } }))[0]).toMatch(/overall rating/);
    expect(validateProps("rating-spotlight", props(1, { aggregate: { source: "google", rating: 6, total: 10 } }))[0]).toMatch(/overall rating/);
  });
});

describe("reviewFits", () => {
  it("uses each template's own limit", () => {
    const text = "x".repeat(300);
    expect(reviewFits(getTemplate("spotlight")!, { text })).toBe(true);
    expect(reviewFits(getTemplate("stack")!, { text })).toBe(false);
  });
});

describe("background styles", () => {
  it("the catalogue lists every style exactly once", () => {
    expect(STYLES.map((x) => x.id).sort()).toEqual([...BACKGROUND_STYLES].sort());
  });

  it("each template has a default style, and the customer's choice overrides it", () => {
    expect(effectiveStyle("spotlight")).toBe("gradient");
    expect(effectiveStyle("minimal")).toBe("light");
    expect(effectiveStyle("dark-card")).toBe("dark");
    expect(effectiveStyle("minimal", { style: "aurora" })).toBe("aurora");
    expect(effectiveStyle("minimal", {})).toBe("light");
    for (const t of TEMPLATES) expect(isBackgroundStyle(t.defaultStyle), t.id).toBe(true);
  });

  it("accepts every style on every template", () => {
    for (const template of TEMPLATES) {
      for (const style of BACKGROUND_STYLES) {
        const sample = SAMPLE_PROPS[template.id];
        expect(validateProps(template.id, { ...sample, theme: { style } }), `${template.id} ${style}`).toEqual([]);
      }
    }
  });

  it("rejects an unknown style and a bad second colour", () => {
    const sample = SAMPLE_PROPS.spotlight;
    expect(validateProps("spotlight", { ...sample, theme: { style: "neon" as never } })[0]).toMatch(/Unknown background style/);
    expect(validateProps("spotlight", { ...sample, theme: { secondary: "blue" } })[0]).toMatch(/second colour/);
    expect(validateProps("spotlight", { ...sample, theme: { secondary: "#1d4ed8" } })).toEqual([]);
  });
});
