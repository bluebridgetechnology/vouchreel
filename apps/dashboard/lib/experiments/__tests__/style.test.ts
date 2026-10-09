import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGET_THEME } from "@/lib/validations/widget-config";
import { createExperimentSchema } from "@/lib/validations/experiments";
import { describeStyleVariant, resolveStyleVariant, styleVariantConfigSchema } from "../style";

const base = { template: "wall-of-love" as const, theme: { ...DEFAULT_WIDGET_THEME, primaryColor: "#123456", shape: "circle" as const, showName: false, columns: 2 } };

describe("style experiment variants", () => {
  it("an empty variant is the widget as it is", () => {
    const out = resolveStyleVariant(base, {});
    expect(out.template).toBe("wall-of-love");
    expect(out.theme).toEqual(base.theme);
  });

  it("a look is put on top of the widget's own theme, keeping its brand colour and what it shows", () => {
    const out = resolveStyleVariant(base, { preset: "cinema" });
    expect(out.theme).toMatchObject({ mode: "dark", background: "#0c0a09", primaryColor: "#123456", showName: false, columns: 2 });
  });

  it("a layout replaces the widget's, and a shape it cannot use goes back to its own look", () => {
    expect(resolveStyleVariant(base, { template: "masonry" })).toMatchObject({ template: "masonry", theme: { shape: "circle" } }); // a masonry wall can use circles
    expect(resolveStyleVariant(base, { template: "carousel" })).toMatchObject({ template: "carousel", theme: { shape: null } }); // a carousel cannot
    expect(resolveStyleVariant(base, { template: "marquee" }).theme.shape).toBeNull();
    expect(resolveStyleVariant(base, { template: "floating-reel" }).theme.shape).toBeNull();
  });

  it("junk config changes nothing and cannot add anything", () => {
    for (const junk of [null, "x", 5, { template: "nope" }, { preset: "nope" }, { id: "x", trigger: { type: "delay" } }]) {
      expect(resolveStyleVariant(base, junk)).toEqual(resolveStyleVariant(base, {}));
    }
  });

  it("does not change what it is given", () => {
    const copy = JSON.parse(JSON.stringify(base));
    resolveStyleVariant(base, { preset: "bold", template: "spotlight" });
    expect(base).toEqual(copy);
  });

  it("only a layout and a known look are accepted", () => {
    expect(styleVariantConfigSchema.safeParse({}).success).toBe(true);
    expect(styleVariantConfigSchema.safeParse({ template: "wall-of-love", preset: "soft" }).success).toBe(true);
    for (const bad of [{ preset: "nope" }, { template: "nope" }, { theme: {} }, { template: "wall-of-love", extra: 1 }]) {
      expect(styleVariantConfigSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("names a variant by its choices", () => {
    const name = (t: string) => t.toUpperCase();
    expect(describeStyleVariant({}, name)).toBe("Current look");
    expect(describeStyleVariant({ preset: "cinema" }, name)).toBe("Dark cinema");
    expect(describeStyleVariant({ template: "carousel", preset: "soft" }, name)).toBe("CAROUSEL, Soft");
  });
});

describe("creating a style experiment", () => {
  const body = (variants: unknown[]) => ({ name: "Looks", type: "style", variants, trafficSplit: [50, 50] });
  it("accepts layout/look variants and refuses anything else", () => {
    expect(createExperimentSchema.safeParse(body([{ id: "a", name: "A", config: {} }, { id: "b", name: "B", config: { preset: "cinema" } }])).success).toBe(true);
    const bad = createExperimentSchema.safeParse(body([{ id: "a", name: "A", config: {} }, { id: "b", name: "B", config: { theme: { primaryColor: "red" } } }]));
    expect(bad.success).toBe(false);
  });
  it("other types still take any config, as before", () => {
    expect(createExperimentSchema.safeParse({ name: "T", type: "position", variants: [{ id: "a", name: "A", config: { position: "bottom-left" } }, { id: "b", name: "B", config: { anything: 1 } }], trafficSplit: [50, 50] }).success).toBe(true);
  });
});
