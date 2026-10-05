import { describe, expect, it } from "vitest";
import { brandForWhiteText, contrastRatio, darken, hexToRgb, mix, readableOn, rgba } from "../lib/theme";

describe("theme helpers", () => {
  it("converts and mixes colours", () => {
    expect(hexToRgb("#cf3d0b")).toEqual({ r: 207, g: 61, b: 11 });
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(darken("#ffffff", 0.5)).toBe("#808080");
    expect(rgba("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });

  it("picks readable text for light and dark backgrounds", () => {
    expect(readableOn("#ffffff")).toBe("#14110f");
    expect(readableOn("#111827")).toBe("#ffffff");
  });

  it("darkens brand colours that would make white text unreadable, and leaves good ones alone", () => {
    for (const brand of ["#ffe14a", "#f5f5f5", "#7fffd4", "#ffffff"]) {
      expect(contrastRatio(brandForWhiteText(brand), "#ffffff"), brand).toBeGreaterThanOrEqual(4.5);
    }
    expect(brandForWhiteText("#cf3d0b")).toBe("#cf3d0b");
  });
});
