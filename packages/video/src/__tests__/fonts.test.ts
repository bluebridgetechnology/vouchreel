import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIDEO_FONT,
  TEMPLATES,
  VIDEO_FONTS,
  VIDEO_FONT_WEIGHTS,
  fontStack,
  getVideoFont,
  isVideoFont,
  maxCharsFor,
  reviewFits,
  validateProps,
  videoFontFile,
  SAMPLE_PROPS,
} from "../registry";
import { fitFontSize } from "../components/primitives";
import { bodyFont, quoteFont, FONT_SANS, FONT_SERIF } from "../lib/theme";

const fontsDir = path.resolve(import.meta.dirname, "../../../../apps/dashboard/public/video-fonts");

describe("font catalogue", () => {
  it("has a handful of fonts, the default first, with unique ids", () => {
    expect(VIDEO_FONTS.length).toBeGreaterThanOrEqual(6);
    expect(VIDEO_FONTS[0].id).toBe(DEFAULT_VIDEO_FONT);
    expect(new Set(VIDEO_FONTS.map((f) => f.id)).size).toBe(VIDEO_FONTS.length);
  });

  it("ships every weight of every font to the dashboard, and an open licence next to it", () => {
    for (const font of VIDEO_FONTS) {
      for (const weight of VIDEO_FONT_WEIGHTS) {
        expect(existsSync(path.join(fontsDir, videoFontFile(font.id, weight))), `${font.id} ${weight}`).toBe(true);
      }
      const licence = path.join(fontsDir, `LICENSE-${font.package}.txt`);
      expect(existsSync(licence), `licence for ${font.id}`).toBe(true);
      expect(readFileSync(licence, "utf8")).toMatch(/SIL Open Font License, Version 1\.1/);
    }
  });

  it("loads every family in the render bundle", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "../lib/fonts.ts"), "utf8");
    for (const font of VIDEO_FONTS) {
      for (const weight of VIDEO_FONT_WEIGHTS) expect(source).toContain(`@fontsource/${font.package}/files/${font.package}-latin-${weight}-normal.woff2`);
      expect(source).toContain(`family: "${font.family}"`);
    }
  });

  it("only ever makes type smaller for wide fonts and bigger for narrow ones, within sane limits", () => {
    for (const font of VIDEO_FONTS) {
      expect(font.sizeScale).toBeGreaterThanOrEqual(0.85);
      expect(font.sizeScale).toBeLessThanOrEqual(1.3);
      expect(font.maxCharsScale).toBeGreaterThan(0.5);
      expect(font.maxCharsScale).toBeLessThanOrEqual(1);
    }
    expect(getVideoFont("outfit")).toMatchObject({ sizeScale: 1, maxCharsScale: 1 });
  });

  it("falls back to the default font for an unknown id", () => {
    expect(getVideoFont("comic-sans").id).toBe(DEFAULT_VIDEO_FONT);
    expect(getVideoFont(undefined).id).toBe(DEFAULT_VIDEO_FONT);
    expect(isVideoFont("lora")).toBe(true);
    expect(isVideoFont("comic-sans")).toBe(false);
    expect(fontStack("lora")).toMatch(/^'Lora', /);
  });
});

describe("a font changes how much text fits", () => {
  const spotlight = TEMPLATES.find((t) => t.id === "spotlight")!;

  it("leaves today's limits and sizes alone when no font is chosen", () => {
    expect(maxCharsFor(spotlight.maxChars, undefined)).toBe(spotlight.maxChars);
    expect(maxCharsFor(spotlight.maxChars, "outfit")).toBe(spotlight.maxChars);
    expect(fitFontSize("x".repeat(100), true)).toBe(64);
    expect(fitFontSize("x".repeat(100), false)).toBe(59);
    expect(bodyFont(undefined)).toBe(FONT_SANS);
    expect(quoteFont(undefined)).toEqual({ fontFamily: FONT_SERIF, fontStyle: "italic" });
  });

  it("shortens the limit for a font that does not fit as much, and still enforces it", () => {
    const limit = maxCharsFor(spotlight.maxChars, "jetbrains-mono");
    expect(limit).toBeLessThan(spotlight.maxChars);
    const long = { text: "a".repeat(limit + 1) };
    expect(reviewFits(spotlight, long, "jetbrains-mono")).toBe(false);
    expect(reviewFits(spotlight, long)).toBe(true);
    const props = { ...SAMPLE_PROPS.spotlight, reviews: [{ ...SAMPLE_PROPS.spotlight.reviews[0], text: long.text }], theme: { font: "jetbrains-mono" as const } };
    expect(validateProps("spotlight", props).join(" ")).toMatch(new RegExp(`${limit} characters.*in this font`));
    expect(validateProps("spotlight", { ...props, theme: {} })).toEqual([]);
  });

  it("scales type to the font", () => {
    expect(fitFontSize("x".repeat(100), true, "jetbrains-mono")).toBeLessThan(fitFontSize("x".repeat(100), true));
    expect(fitFontSize("x".repeat(100), true, "caveat")).toBeGreaterThan(fitFontSize("x".repeat(100), true));
  });

  it("rejects an unknown font", () => {
    const props = { ...SAMPLE_PROPS.spotlight, theme: { font: "wingdings" as never } };
    expect(validateProps("spotlight", props)).toContain('Unknown font "wingdings".');
  });

  it("uses a chosen font for the Minimal quote, upright", () => {
    expect(quoteFont("lora")).toMatchObject({ fontStyle: "normal" });
    expect(quoteFont("lora").fontFamily).toMatch(/^'Lora'/);
  });
});
