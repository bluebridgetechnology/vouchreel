import { describe, expect, it, vi } from "vitest";
import { applyBrandKitToTheme, collectBrandFromKit, contrastBetween, describeFont, type BrandKitValues } from "../theme";
import { brandKitSchema, normalizeHex } from "@/lib/validations/brand-kit";
import { valuesToStore } from "../service";

// service.ts imports the db module at load time; these tests only use its pure helpers
vi.mock("@/lib/db", () => ({ db: {} }));

const kit = (over: Partial<BrandKitValues> = {}): BrandKitValues => ({
  primaryColor: "#112233",
  accentColor: null,
  borderRadius: null,
  fontMode: "inherit",
  fontFamily: null,
  inheritTextColor: false,
  videoStyle: null,
  videoSecondaryColor: null,
  ...over,
});

const theme = { primaryColor: "#3b82f6", accentColor: "#ffffff", mode: "dark", borderRadius: 8 };

describe("applyBrandKitToTheme", () => {
  it("returns the theme untouched without a kit", () => {
    expect(applyBrandKitToTheme(theme, null)).toBe(theme);
  });

  it("the kit decides colours, radius and typography; the widget keeps its mode", () => {
    const result = applyBrandKitToTheme(theme, kit({ accentColor: "#000000", borderRadius: 16, fontMode: "custom", fontFamily: "Poppins", inheritTextColor: true }));
    expect(result).toEqual({
      primaryColor: "#112233",
      accentColor: "#000000",
      mode: "dark",
      borderRadius: 16,
      fontMode: "custom",
      fontFamily: "Poppins",
      inheritTextColor: true,
    });
  });

  it("an unset accent or radius leaves the widget's own value alone", () => {
    const result = applyBrandKitToTheme(theme, kit());
    expect(result.accentColor).toBe("#ffffff");
    expect(result.borderRadius).toBe(8);
  });

  it("only sends a font name in custom mode", () => {
    expect(applyBrandKitToTheme(theme, kit({ fontMode: "inherit", fontFamily: "Poppins" }))).not.toHaveProperty("fontFamily");
    expect(applyBrandKitToTheme(theme, kit({ fontMode: "default", fontFamily: "Poppins" }))).not.toHaveProperty("fontFamily");
    expect(applyBrandKitToTheme(theme, kit({ fontMode: "custom", fontFamily: null }))).not.toHaveProperty("fontFamily");
  });

  it("does not mutate its input", () => {
    const original = { ...theme };
    applyBrandKitToTheme(theme, kit({ borderRadius: 2 }));
    expect(theme).toEqual(original);
  });
});

describe("describeFont and contrast", () => {
  it("describes each font choice", () => {
    expect(describeFont({ fontMode: "inherit", fontFamily: null })).toMatch(/your site's font/i);
    expect(describeFont({ fontMode: "custom", fontFamily: "Poppins" })).toBe("Poppins (from your site)");
    expect(describeFont({ fontMode: "default", fontFamily: null })).toMatch(/default/i);
  });

  it("computes WCAG contrast for 3 and 6 digit hex", () => {
    expect(contrastBetween("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastBetween("#000", "#fff")).toBeCloseTo(21, 0);
    expect(contrastBetween("#777777", "#777777")).toBe(1);
  });
});

describe("brandKitSchema", () => {
  const valid = { primaryColor: "#CF3D0B", fontMode: "inherit", inheritTextColor: false };

  it("accepts a minimal kit and normalises colours to lowercase 6-digit hex", () => {
    const parsed = brandKitSchema.parse({ ...valid, accentColor: "#FFF" });
    expect(parsed.primaryColor).toBe("#cf3d0b");
    expect(parsed.accentColor).toBe("#ffffff");
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
  });

  it("rejects bad colours and out-of-range radius", () => {
    expect(brandKitSchema.safeParse({ ...valid, primaryColor: "red" }).success).toBe(false);
    expect(brandKitSchema.safeParse({ ...valid, primaryColor: "#12345" }).success).toBe(false);
    expect(brandKitSchema.safeParse({ ...valid, borderRadius: 25 }).success).toBe(false);
    expect(brandKitSchema.safeParse({ ...valid, borderRadius: -1 }).success).toBe(false);
    expect(brandKitSchema.safeParse({ ...valid, borderRadius: 4.5 }).success).toBe(false);
  });

  it("custom font mode needs a font name", () => {
    expect(brandKitSchema.safeParse({ ...valid, fontMode: "custom" }).success).toBe(false);
    expect(brandKitSchema.safeParse({ ...valid, fontMode: "custom", fontFamily: "Poppins" }).success).toBe(true);
  });

  it.each([
    "Poppins; color: red",
    "Poppins } body { display: none",
    "url(https://evil.test/x.woff)",
    'Poppins"',
    "Poppins, Arial",
    "a".repeat(41),
    "<b>",
  ])("rejects an unsafe font name: %j", (fontFamily) => {
    expect(brandKitSchema.safeParse({ ...valid, fontMode: "custom", fontFamily }).success).toBe(false);
  });

  it("accepts ordinary font names", () => {
    for (const fontFamily of ["Poppins", "Open Sans", "IBM Plex Sans", "Source-Serif_4"]) {
      expect(brandKitSchema.safeParse({ ...valid, fontMode: "custom", fontFamily }).success, fontFamily).toBe(true);
    }
  });

  it("rejects unknown font modes", () => {
    expect(brandKitSchema.safeParse({ ...valid, fontMode: "magic" }).success).toBe(false);
  });
});

describe("valuesToStore", () => {
  it("drops a stale font name when the mode does not use one", () => {
    const input = brandKitSchema.parse({ primaryColor: "#cf3d0b", fontMode: "inherit", fontFamily: "Poppins", inheritTextColor: false });
    expect(valuesToStore(input).fontFamily).toBeNull();
    const custom = brandKitSchema.parse({ primaryColor: "#cf3d0b", fontMode: "custom", fontFamily: "Poppins", inheritTextColor: false });
    expect(valuesToStore(custom).fontFamily).toBe("Poppins");
  });

  it("stores unset optional fields as null", () => {
    const stored = valuesToStore(brandKitSchema.parse({ primaryColor: "#cf3d0b", fontMode: "default", inheritTextColor: false }));
    expect(stored).toMatchObject({ accentColor: null, borderRadius: null, fontFamily: null });
  });
});

describe("video style defaults", () => {
  const base = { primaryColor: "#cf3d0b", fontMode: "inherit", inheritTextColor: false };

  it("accepts every background style, or none (each template then uses its own default)", () => {
    for (const videoStyle of ["gradient", "solid", "aurora", "dots", "light", "dark", null]) {
      expect(brandKitSchema.safeParse({ ...base, videoStyle }).success, String(videoStyle)).toBe(true);
    }
    expect(brandKitSchema.safeParse({ ...base }).success).toBe(true);
  });

  it("rejects unknown styles and bad second colours; normalises a valid one", () => {
    expect(brandKitSchema.safeParse({ ...base, videoStyle: "neon" }).success).toBe(false);
    expect(brandKitSchema.safeParse({ ...base, videoSecondaryColor: "blue" }).success).toBe(false);
    expect(brandKitSchema.parse({ ...base, videoSecondaryColor: "#ABC" }).videoSecondaryColor).toBe("#aabbcc");
  });

  it("stores the style, and drops a second colour that the light and dark styles ignore", () => {
    const aurora = valuesToStore(brandKitSchema.parse({ ...base, videoStyle: "aurora", videoSecondaryColor: "#1d4ed8" }));
    expect(aurora).toMatchObject({ videoStyle: "aurora", videoSecondaryColor: "#1d4ed8" });
    const light = valuesToStore(brandKitSchema.parse({ ...base, videoStyle: "light", videoSecondaryColor: "#1d4ed8" }));
    expect(light).toMatchObject({ videoStyle: "light", videoSecondaryColor: null });
  });

  it("no style stored means null (template default), not a made-up value", () => {
    expect(valuesToStore(brandKitSchema.parse(base))).toMatchObject({ videoStyle: null, videoSecondaryColor: null });
  });
});

describe("collectBrandFromKit", () => {
  it("does nothing without a kit or a form colour", () => {
    expect(collectBrandFromKit(null, null)).toEqual({ accentColor: null, textColor: null, borderRadius: null });
  });

  it("uses the kit's colour, text colour and radius when the form has no colour of its own", () => {
    expect(collectBrandFromKit(undefined, kit({ primaryColor: "#112233", accentColor: "#ffffff", borderRadius: 12 }))).toEqual({
      accentColor: "#112233",
      textColor: "#ffffff",
      borderRadius: 12,
    });
  });

  it("a colour chosen on the form wins over the kit, and the kit's text colour is not used with it", () => {
    expect(collectBrandFromKit("#ffee00", kit({ accentColor: "#ffffff" }))).toMatchObject({ accentColor: "#ffee00", textColor: null });
  });

  it("falls back (null) when the kit's text colour is unreadable on its colour", () => {
    expect(collectBrandFromKit(undefined, kit({ primaryColor: "#ffee00", accentColor: "#ffffff" })).textColor).toBeNull();
  });
});
