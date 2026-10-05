import { describe, expect, it } from "vitest";
import { hexToRgb, hslToHex, luminance, rgbToHsl, shiftHue } from "../lib/theme";

describe("hue helpers", () => {
  it("round-trips colours through HSL", () => {
    for (const hex of ["#cf3d0b", "#0a7d5a", "#2b50d6", "#ffe14a", "#808080", "#000000", "#ffffff"]) {
      expect(hslToHex(rgbToHsl(hexToRgb(hex))), hex).toBe(hex);
    }
  });

  it("rotates the hue and keeps the brightness, so text contrast barely changes", () => {
    for (const hex of ["#cf3d0b", "#0a7d5a", "#2b50d6", "#7c3aed"]) {
      for (const deg of [-60, -35, 35, 60]) {
        const shifted = shiftHue(hex, deg);
        expect(shifted, `${hex} ${deg}`).not.toBe(hex);
        expect(Math.abs(luminance(shifted) - luminance(hex)), `${hex} ${deg}`).toBeLessThan(0.02);
      }
    }
  });

  it("leaves greys alone and wraps around the colour wheel", () => {
    expect(shiftHue("#808080", 90)).toBe("#808080");
    expect(Math.abs(luminance(shiftHue("#cf3d0b", 360)) - luminance("#cf3d0b"))).toBeLessThan(0.02);
  });
});
