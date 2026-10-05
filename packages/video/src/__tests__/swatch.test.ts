import { describe, expect, it } from "vitest";
import { derivePalette, MIN_TEXT_CONTRAST } from "../lib/palette";
import { swatchFor } from "../lib/swatch";
import { contrastRatio } from "../lib/theme";
import { BACKGROUND_STYLES } from "../types";

describe("swatchFor", () => {
  it("returns a CSS background and a readable text colour for every style", () => {
    for (const style of BACKGROUND_STYLES) {
      for (const brand of ["#cf3d0b", "#ffe14a", "#1b1b1b", "#0a7d5a"]) {
        const palette = derivePalette(brand, { style });
        const swatch = swatchFor(palette);
        expect(swatch.background, `${style} ${brand}`).toBeTruthy();
        expect(contrastRatio(swatch.color, palette.bgFrom), `${style} ${brand}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }
    }
  });

  it("solid is one flat colour, gradient and light use a gradient", () => {
    expect(swatchFor(derivePalette("#0a7d5a", { style: "solid" })).background).toBe(derivePalette("#0a7d5a", { style: "solid" }).bgFrom);
    expect(swatchFor(derivePalette("#0a7d5a", { style: "gradient" })).background).toContain("linear-gradient");
    expect(swatchFor(derivePalette("#0a7d5a", { style: "light" })).background).toContain("linear-gradient");
  });

  it("aurora layers three glows, dots adds a pattern, dark adds a glow", () => {
    expect(swatchFor(derivePalette("#0a7d5a", { style: "aurora" })).background.match(/radial-gradient/g)).toHaveLength(3);
    const dots = swatchFor(derivePalette("#0a7d5a", { style: "dots" }));
    expect(dots.backgroundSize).toBeTruthy();
    expect(dots.background).toContain("radial-gradient");
    expect(swatchFor(derivePalette("#0a7d5a", { style: "dark" })).background).toContain("radial-gradient");
  });

  it("follows the brand colour: different colours give different swatches", () => {
    const a = swatchFor(derivePalette("#cf3d0b", { style: "gradient" })).background;
    const b = swatchFor(derivePalette("#0a7d5a", { style: "gradient" })).background;
    expect(a).not.toBe(b);
  });
});
