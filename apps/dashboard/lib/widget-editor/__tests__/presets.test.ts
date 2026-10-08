import { describe, expect, it } from "vitest";
import { applyPreset, matchingPreset, PRESET_FIELDS, STYLE_PRESETS } from "../presets";
import { WIDGET_MODE_COLOURS } from "../mode-colours";
import { DEFAULT_WIDGET_THEME, normalizeTheme, widgetThemeSchema } from "@/lib/validations/widget-config";
import { contrastBetween, MIN_BUTTON_CONTRAST } from "@/lib/brand-kit/theme";

describe("style presets", () => {
  it.each(STYLE_PRESETS.map((p) => [p.name, p] as const))("%s is a valid theme that normalizes to itself", (_name, preset) => {
    const theme = applyPreset(DEFAULT_WIDGET_THEME, preset);
    expect(widgetThemeSchema.safeParse(theme).success).toBe(true);
    expect(normalizeTheme(theme)).toEqual(theme);
  });

  it.each(STYLE_PRESETS.map((p) => [p.name, p] as const))("%s keeps its text readable on its cards", (_name, preset) => {
    const mode = WIDGET_MODE_COLOURS[preset.theme.mode];
    const bg = preset.theme.background ?? mode.background;
    const text = preset.theme.textColor ?? mode.text;
    expect(contrastBetween(bg, text)).toBeGreaterThanOrEqual(MIN_BUTTON_CONTRAST);
  });

  it("sets every preset field, and never the owner's brand colours or content choices", () => {
    for (const p of STYLE_PRESETS) {
      expect(Object.keys(p.theme).sort()).toEqual([...PRESET_FIELDS].sort());
      expect(p.theme).not.toHaveProperty("primaryColor");
      expect(p.theme).not.toHaveProperty("accentColor");
    }
    const mine = { ...DEFAULT_WIDGET_THEME, primaryColor: "#123456", showCompany: false, columns: 2 };
    const applied = applyPreset(mine, STYLE_PRESETS[2]);
    expect(applied).toMatchObject({ primaryColor: "#123456", showCompany: false, columns: 2 });
  });

  it("every preset looks different, so each one is worth a click", () => {
    const looks = STYLE_PRESETS.map((p) => JSON.stringify(p.theme));
    expect(new Set(looks).size).toBe(looks.length);
    expect(new Set(STYLE_PRESETS.map((p) => p.id)).size).toBe(STYLE_PRESETS.length);
  });

  it("recognises a preset only while all its fields match", () => {
    const glass = STYLE_PRESETS.find((p) => p.id === "glass")!;
    const theme = applyPreset(DEFAULT_WIDGET_THEME, glass);
    expect(matchingPreset(theme)?.id).toBe("glass");
    expect(matchingPreset({ ...theme, shadow: "strong" })).toBeNull();
    expect(matchingPreset({ ...theme, primaryColor: "#000000" })?.id).toBe("glass"); // brand colour is not part of it
  });
});
