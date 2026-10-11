import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WIDGET_MODE_COLOURS } from "../mode-colours";
import { LAYOUTS } from "../layouts";
import { WIDGET_TEMPLATES } from "@/lib/validations/widget-config";

const css = readFileSync(new URL("../../../../../packages/widget/src/styles.css", import.meta.url), "utf8");

/** The body of the first rule with exactly this selector. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
}
const token = (body: string, name: string) => body.split("\n").find((l) => l.trim().startsWith(`${name}:`))?.split(":")[1].replace(";", "").trim();

describe("the editor's idea of the widget", () => {
  it("mode colours match the widget's own tokens", () => {
    const light = block(".vr-theme-root");
    const dark = block(".vr-theme-root.vr-dark");
    expect(token(light, "--vr-bg")).toBe(WIDGET_MODE_COLOURS.light.background);
    expect(token(light, "--vr-text")).toBe(WIDGET_MODE_COLOURS.light.text);
    expect(token(dark, "--vr-bg")).toBe(WIDGET_MODE_COLOURS.dark.background);
    expect(token(dark, "--vr-text")).toBe(WIDGET_MODE_COLOURS.dark.text);
  });

  it("describes every layout the widget has, once", () => {
    expect(LAYOUTS.map((l) => l.id).sort()).toEqual([...WIDGET_TEMPLATES].sort());
  });
});
