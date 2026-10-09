import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGET_THEME } from "@/lib/validations/widget-config";
import { copyStyle, STYLE_FIELDS } from "../copy-style";

const source = {
  ...DEFAULT_WIDGET_THEME,
  primaryColor: "#112233",
  accentColor: "#eeeeee",
  mode: "dark" as const,
  borderRadius: 24,
  background: "#0c0a09",
  size: "lg" as const,
  shadow: "strong" as const,
  glass: true,
  gap: "loose" as const,
  entrance: "pop" as const,
  shape: "circle" as const,
  showStars: false,
  columns: 4,
  autoAdvance: 9,
};
const target = { ...DEFAULT_WIDGET_THEME, showName: false, showQuote: false, columns: 2, autoAdvance: 3, shape: "landscape" as const };

describe("copy style", () => {
  it("brings over the look and keeps what the target shows and how it behaves", () => {
    const out = copyStyle(source, target, "wall-of-love");
    for (const f of STYLE_FIELDS) expect(out[f]).toEqual(source[f]);
    expect(out).toMatchObject({ showName: false, showQuote: false, showStars: true, columns: 2, autoAdvance: 3 });
  });

  it("keeps the shape when the target's layout can use it, else the layout's own look", () => {
    expect(copyStyle(source, target, "wall-of-love").shape).toBe("circle");
    expect(copyStyle(source, target, "floating-reel").shape).toBeNull(); // no circles in a reel
    expect(copyStyle(source, target, "marquee").shape).toBeNull(); // no shapes at all
    expect(copyStyle({ ...source, shape: null }, target, "wall-of-love").shape).toBeNull();
  });

  it("copes with settings that are old, partial or damaged", () => {
    const out = copyStyle({ primaryColor: "not a colour", borderRadius: 4 }, null, "carousel");
    expect(out).toMatchObject({ primaryColor: DEFAULT_WIDGET_THEME.primaryColor, borderRadius: 4, columns: 3 });
  });

  it("does not change its inputs", () => {
    const t = { ...target };
    copyStyle(source, t, "wall-of-love");
    expect(t).toEqual(target);
  });
});
