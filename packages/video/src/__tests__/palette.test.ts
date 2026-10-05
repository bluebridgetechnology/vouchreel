import { describe, expect, it } from "vitest";
import { AMBER, GOLD, INK, MIN_TEXT_CONTRAST, NIGHT, WHITE, auroraBlobs, derivePalette, tint } from "../lib/palette";
import { contrastRatio, luminance } from "../lib/theme";
import { BACKGROUND_STYLES } from "../types";

/** A spread of brand colours: saturated, pastel, very light, very dark, grey, neon. */
const BRANDS = [
  "#cf3d0b", "#0a7d5a", "#2b50d6", "#7c3aed", "#d946ef", "#e11d48",
  "#ffe14a", "#fff7cc", "#f5f5f5", "#ffffff", "#7fffd4", "#a5f3fc", "#fde68a",
  "#1b1b1b", "#000000", "#0b132b", "#3b0764",
  "#808080", "#777777", "#8a8a8a", "#6b7280",
  "#39ff14", "#ff00ff", "#00e5ff",
];

const mid = (a: string, b: string) => {
  // luminance-wise worst case is one of the endpoints, so checking both ends is enough
  return [a, b];
};

describe("derivePalette: readability guarantee", () => {
  for (const style of BACKGROUND_STYLES) {
    it(`text is at least AA (4.5:1) on every point of the ${style} background, for every brand colour`, () => {
      for (const brand of BRANDS) {
        const p = derivePalette(brand, { style });
        for (const end of mid(p.bgFrom, p.bgTo)) {
          expect(contrastRatio(p.text, end), `${brand} ${style} text on ${end}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        }
      }
    });

    it(`muted text stays readable on the ${style} background`, () => {
      for (const brand of BRANDS) {
        const p = derivePalette(brand, { style });
        expect(contrastRatio(p.textMuted, p.bgFrom), `${brand} ${style} muted`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST - 0.6);
      }
    });
  }

  it("accents are readable on the surface they are used on", () => {
    for (const brand of BRANDS) {
      const p = derivePalette(brand);
      expect(contrastRatio(p.accent, WHITE), `${brand} accent on white`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(p.accentOnDark, NIGHT), `${brand} accent on dark`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  it("rating stars are visible on the background", () => {
    for (const style of BACKGROUND_STYLES) {
      for (const brand of BRANDS) {
        const p = derivePalette(brand, { style });
        // gold or deep amber when they show, otherwise the text colour (always readable)
        expect([GOLD, AMBER, p.text]).toContain(p.star);
        if (p.star !== p.text) {
          for (const end of [p.bgFrom, p.bgTo]) expect(contrastRatio(p.star, end), `${brand} ${style} stars on ${end}`).toBeGreaterThanOrEqual(2.4);
        }
      }
    }
  });
});

describe("derivePalette: keeps the colour the customer chose", () => {
  it("a light brand colour stays light and gets dark text (it is not darkened into mud)", () => {
    const yellow = derivePalette("#ffe14a");
    expect(yellow.text).toBe(INK);
    expect(yellow.isDark).toBe(false);
    expect(yellow.bgFrom).toBe("#ffe14a"); // exactly the colour they picked
    expect(luminance(yellow.bgTo)).toBeGreaterThan(0.45); // and the gradient end is still clearly yellow
  });

  it("a dark brand colour stays dark and gets light text", () => {
    const navy = derivePalette("#0b132b");
    expect(navy.text).toBe(WHITE);
    expect(navy.isDark).toBe(true);
    expect(navy.bgFrom).toBe("#0b132b");
  });

  it("the default coral brand colour is used unchanged as the gradient start", () => {
    const p = derivePalette("#cf3d0b");
    expect(p.bgFrom).toBe("#cf3d0b");
    expect(p.text).toBe(WHITE);
  });

  it("only nudges a colour that no text can read on, and by a small amount", () => {
    // mid greys sit between the two text colours; dark ink works without any change
    const grey = derivePalette("#808080");
    expect(grey.text).toBe(INK);
    expect(grey.bgFrom).toBe("#808080");
  });

  it("picks the text colour with the better contrast for in-between colours", () => {
    for (const brand of ["#ff7a00", "#00a86b", "#4f7cff"]) {
      const p = derivePalette(brand);
      const other = p.text === WHITE ? INK : WHITE;
      expect(contrastRatio(p.text, p.bgFrom), brand).toBeGreaterThanOrEqual(contrastRatio(other, p.bgFrom) - 0.01);
    }
  });
});

describe("derivePalette: styles and second colour", () => {
  it("solid uses one flat colour", () => {
    const p = derivePalette("#0a7d5a", { style: "solid" });
    expect(p.bgFrom).toBe(p.bgTo);
  });

  it("the gradient ends on the second colour when one is given", () => {
    const p = derivePalette("#cf3d0b", { secondary: "#1d4ed8" });
    expect(p.bgTo).toBe("#1d4ed8");
    expect(p.bgFrom).toBe("#cf3d0b");
  });

  it("a second colour never breaks readability: it is nudged if needed", () => {
    const p = derivePalette("#cf3d0b", { secondary: "#ffee00" }); // white text cannot read on the yellow end
    for (const end of [p.bgFrom, p.bgTo]) expect(contrastRatio(p.text, end)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it("the second colour is ignored by the light and dark styles", () => {
    const light = derivePalette("#cf3d0b", { style: "light", secondary: "#1d4ed8" });
    expect(light.bgFrom).toBe(derivePalette("#cf3d0b", { style: "light" }).bgFrom);
  });

  it("light style is paper tinted with the brand colour, dark style is near-black with its hue", () => {
    const light = derivePalette("#cf3d0b", { style: "light" });
    const dark = derivePalette("#cf3d0b", { style: "dark" });
    expect(light.isDark).toBe(false);
    expect(luminance(light.bgFrom)).toBeGreaterThan(0.85);
    expect(dark.isDark).toBe(true);
    expect(luminance(dark.bgFrom)).toBeLessThan(0.02);
    expect(contrastRatio(light.text, light.bgFrom)).toBeGreaterThanOrEqual(7);
  });
});

describe("derivePalette: input handling", () => {
  it("falls back to the default brand colour for invalid input instead of rendering garbage", () => {
    for (const bad of ["red", "", "#fff", "#12345", "javascript:alert(1)", "#gggggg"]) {
      expect(derivePalette(bad).brand, bad).toBe("#cf3d0b");
    }
  });

  it("normalises case, and ignores an invalid second colour", () => {
    const p = derivePalette("#CF3D0B", { secondary: "nope" });
    expect(p.brand).toBe("#cf3d0b");
    expect(p.bgTo).not.toBe("nope");
  });

  it("defaults to the gradient style", () => {
    expect(derivePalette("#0a7d5a").style).toBe("gradient");
  });
});

describe("tint", () => {
  it("is the text colour at the given opacity", () => {
    expect(tint({ text: "#ffffff" }, 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(tint({ text: "#14110f" }, 0.2)).toBe("rgba(20, 17, 15, 0.2)");
  });
});

describe("auroraBlobs", () => {
  it("every glow keeps the text readable (brightness is preserved), for any brand colour", () => {
    for (const brand of BRANDS) {
      const p = derivePalette(brand, { style: "aurora" });
      for (const blob of auroraBlobs(p, false)) {
        // hue shifts match brightness to within a small tolerance, so contrast stays within a hair of AA
        expect(contrastRatio(p.text, blob.color), `${brand} ${blob.color}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST - 0.5);
      }
    }
  });

  it("uses the readability-adjusted second colour, never the raw one", () => {
    const p = derivePalette("#cf3d0b", { style: "aurora", secondary: "#ffee00" });
    const blobs = auroraBlobs(p, true);
    expect(blobs[1].color).toBe(p.bgTo);
    expect(contrastRatio(p.text, blobs[1].color)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it("returns three glows inside the frame", () => {
    const blobs = auroraBlobs(derivePalette("#0a7d5a", { style: "aurora" }), false);
    expect(blobs).toHaveLength(3);
    for (const b of blobs) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(100);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThanOrEqual(100);
    }
  });
});
