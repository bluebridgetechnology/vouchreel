import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGET_CONFIG, type UpdateWidgetConfigInput } from "@/lib/validations/widget-config";
import { canonical, changedAreas, sameSettings, versionSummary } from "../history";

const base = (): UpdateWidgetConfigInput => ({
  template: DEFAULT_WIDGET_CONFIG.template,
  position: DEFAULT_WIDGET_CONFIG.position,
  theme: { ...DEFAULT_WIDGET_CONFIG.theme },
  triggerType: DEFAULT_WIDGET_CONFIG.triggerType,
  triggerValue: { ...DEFAULT_WIDGET_CONFIG.triggerValue },
  pagesIncluded: ["*"],
  pagesExcluded: [],
  autoplayPreview: false,
});

describe("comparing settings", () => {
  it("treats the same settings as equal whatever the key order", () => {
    expect(sameSettings({ a: 1, b: { c: [1, 2], d: null } }, { b: { d: null, c: [1, 2] }, a: 1 })).toBe(true);
    expect(sameSettings({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameSettings([1, 2], [2, 1])).toBe(false); // order matters in a list
    expect(canonical(undefined)).toBe("null");
  });
});

describe("what changed between two versions", () => {
  it("is nothing for identical settings, and for a theme saved before newer fields existed", () => {
    expect(changedAreas(base(), base())).toEqual([]);
    const old = { ...base(), theme: { primaryColor: "#cf3d0b", accentColor: "#ffffff", mode: "light" as const, borderRadius: 12 } };
    expect(changedAreas(old, base())).toEqual([]);
  });

  it("names each area in the owner's words", () => {
    const a = base();
    const b = (patch: Partial<UpdateWidgetConfigInput>, theme: Partial<UpdateWidgetConfigInput["theme"]> = {}): UpdateWidgetConfigInput => ({ ...a, ...patch, theme: { ...a.theme, ...theme } });
    expect(changedAreas(a, b({ template: "wall-of-love" }))).toEqual(["Layout"]);
    expect(changedAreas(a, b({}, { primaryColor: "#112233" }))).toEqual(["Colours"]);
    expect(changedAreas(a, b({}, { mode: "dark" }))).toEqual(["Colours"]);
    expect(changedAreas(a, b({}, { borderRadius: 30, shadow: "strong" }))).toEqual(["Look"]);
    expect(changedAreas(a, b({}, { showStars: false }))).toEqual(["What it shows"]);
    expect(changedAreas(a, b({}, { columns: 2 }))).toEqual(["Columns and spacing"]);
    expect(changedAreas(a, b({ position: "bottom-left" }))).toEqual(["Position"]);
    expect(changedAreas(a, b({ triggerType: "exit-intent", triggerValue: {} }))).toEqual(["Timing"]);
    expect(changedAreas(a, b({ pagesExcluded: ["/checkout"] }))).toEqual(["Pages"]);
    expect(changedAreas(a, b({ autoplayPreview: true }))).toEqual(["Autoplay"]);
  });

  it("lists several areas in a fixed order", () => {
    const a = base();
    const next = { ...a, template: "carousel" as const, position: "bottom-left" as const, theme: { ...a.theme, primaryColor: "#000000", glass: true } };
    expect(changedAreas(a, next)).toEqual(["Layout", "Colours", "Look", "Position"]);
  });
});

describe("the line for a version", () => {
  it("says what it was and what it changed", () => {
    expect(versionSummary("before", null)).toBe("How it was before history began");
    expect(versionSummary("publish", ["Layout", "Colours"])).toBe("Published. Changed: layout, colours");
    expect(versionSummary("experiment", ["Look"])).toBe("Experiment winner. Changed: look");
    expect(versionSummary("publish", [])).toBe("Published. No visible change");
    expect(versionSummary("publish", null)).toBe("Published");
  });
});
