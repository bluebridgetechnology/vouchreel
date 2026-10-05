import { describe, expect, it } from "vitest";
import { FALLBACK_STACK, contrastRatio, fontFamilyFor, parseCssColor, readableInheritedColor, sanitizeFontFamily } from "../typography";

describe("sanitizeFontFamily", () => {
  it("accepts plain family names and quotes them", () => {
    expect(sanitizeFontFamily("Poppins")).toBe('"Poppins"');
    expect(sanitizeFontFamily("Open Sans")).toBe('"Open Sans"');
    expect(sanitizeFontFamily("'Playfair Display'")).toBe('"Playfair Display"');
    expect(sanitizeFontFamily('"IBM Plex Sans"')).toBe('"IBM Plex Sans"');
  });

  it("accepts a short list with generic keywords", () => {
    expect(sanitizeFontFamily("Inter, Helvetica, sans-serif")).toBe('"Inter", "Helvetica", sans-serif');
    expect(sanitizeFontFamily("Georgia, SERIF")).toBe('"Georgia", serif');
  });

  it.each([
    "Poppins; color: red",
    "Poppins } body { display: none",
    "url(https://evil.test/x.woff)",
    "Poppins /* comment */",
    "Poppins\\",
    'Poppins"; background: url(x)',
    "<script>alert(1)</script>",
    "Poppins, ",
    ",",
    "a, b, c, d, e",
    "x".repeat(41),
    "",
    "   ",
    "-Poppins",
    "Pop(pins)",
  ])("rejects %j", (input) => {
    expect(sanitizeFontFamily(input)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(sanitizeFontFamily(undefined)).toBeNull();
    expect(sanitizeFontFamily(42)).toBeNull();
    expect(sanitizeFontFamily({ toString: () => "Poppins" })).toBeNull();
  });
});

describe("fontFamilyFor", () => {
  it("inherit uses the host page's font", () => {
    expect(fontFamilyFor("inherit", undefined)).toBe("inherit");
  });

  it("custom uses the named font, falling back to the widget stack", () => {
    expect(fontFamilyFor("custom", "Poppins")).toBe(`"Poppins", ${FALLBACK_STACK}`);
  });

  it("custom with an unsafe or missing name keeps the default font instead of applying junk", () => {
    expect(fontFamilyFor("custom", "x; y")).toBeNull();
    expect(fontFamilyFor("custom", undefined)).toBeNull();
  });

  it("default and unknown modes change nothing", () => {
    expect(fontFamilyFor("default", "Poppins")).toBeNull();
    expect(fontFamilyFor(undefined, "Poppins")).toBeNull();
    expect(fontFamilyFor("nonsense", "Poppins")).toBeNull();
  });
});

describe("parseCssColor", () => {
  it("parses what getComputedStyle reports", () => {
    expect(parseCssColor("rgb(28, 25, 23)")).toEqual({ r: 28, g: 25, b: 23, a: 1 });
    expect(parseCssColor("rgba(0, 0, 0, 0.5)")).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(parseCssColor("rgb(10 20 30 / 50%)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
  });

  it("parses hex", () => {
    expect(parseCssColor("#1c1917")).toEqual({ r: 28, g: 25, b: 23, a: 1 });
    expect(parseCssColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it("rejects anything else", () => {
    for (const bad of ["red", "", "rgb(300, 0, 0)", "rgb(1, 2)", "hsl(0, 0%, 0%)", "var(--x)", "rgba(0, 0, 0, 2)"]) {
      expect(parseCssColor(bad), bad).toBeNull();
    }
  });
});

describe("readableInheritedColor", () => {
  const lightBg = "rgb(255, 255, 255)";
  const darkBg = "rgb(28, 25, 23)";

  it("uses the site's text colour when it is readable on the widget background", () => {
    expect(readableInheritedColor("rgb(51, 51, 51)", lightBg)).toBe("rgb(51, 51, 51)");
    expect(readableInheritedColor("rgb(240, 240, 240)", darkBg)).toBe("rgb(240, 240, 240)");
  });

  it("refuses a colour that would be unreadable, e.g. a light-on-dark site on the white card", () => {
    expect(readableInheritedColor("rgb(245, 245, 245)", lightBg)).toBeNull();
    expect(readableInheritedColor("rgb(40, 40, 40)", darkBg)).toBeNull();
  });

  it("refuses translucent or unparseable colours", () => {
    expect(readableInheritedColor("rgba(0, 0, 0, 0.4)", lightBg)).toBeNull();
    expect(readableInheritedColor("transparent", lightBg)).toBeNull();
    expect(readableInheritedColor("rgb(0, 0, 0)", "")).toBeNull();
  });

  it("applies the WCAG AA threshold", () => {
    // #767676 on white is the classic 4.54:1 borderline pass; #777777 is just under
    expect(readableInheritedColor("#767676", lightBg)).toBe("rgb(118, 118, 118)");
    expect(readableInheritedColor("#808080", lightBg)).toBeNull();
    expect(contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 })).toBeCloseTo(21, 0);
  });
});
