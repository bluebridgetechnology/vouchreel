import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAYOUTS, shapeForLayout } from "../layouts";
import { WIDGET_SHAPES } from "@/lib/validations/widget-config";

const widgetCss = (file: string) => readFileSync(new URL(`../../../../../packages/widget/src/${file}`, import.meta.url), "utf8");

/** Where each layout's shape rules live: the core for the floating card, otherwise the layout's own chunk. */
const SHEETS: Record<string, string> = {
  "floating-card": widgetCss("styles.css"),
  "story-strip": widgetCss("layouts/story-strip.css"),
  "floating-bubble": widgetCss("layouts/floating-bubble.css"),
  "floating-reel": widgetCss("layouts/floating-reel.css"),
  "reel-feed": widgetCss("layouts/reel-feed.css"),
  spotlight: widgetCss("layouts/spotlight.css"),
  "rating-badge": "",
  marquee: "",
  carousel: widgetCss("layouts/cards.css"),
  "wall-of-love": widgetCss("layouts/cards.css"),
  masonry: widgetCss("layouts/cards.css"),
};

describe("shapes", () => {
  it("each layout offers only real shapes, without repeats", () => {
    for (const l of LAYOUTS) {
      // A layout with no picture to shape offers none; otherwise there is a real choice
      expect(l.shapes.length === 0 || l.shapes.length > 1).toBe(true);
      expect(new Set(l.shapes).size).toBe(l.shapes.length);
      for (const s of l.shapes) expect(WIDGET_SHAPES).toContain(s);
    }
  });

  it("every shape a layout offers (other than its own default look) has a rule in the widget", () => {
    for (const l of LAYOUTS) {
      for (const shape of l.shapes.slice(1)) {
        expect(SHEETS[l.id], `${l.id}: ${shape}`).toContain(`.vr-shape-${shape} `);
      }
    }
  });

  it("switching layout keeps a shape the new layout has, and drops one it does not", () => {
    expect(shapeForLayout("vertical", "story-strip")).toBe("vertical");
    expect(shapeForLayout("landscape", "story-strip")).toBeNull();
    expect(shapeForLayout("circle", "carousel")).toBeNull();
    expect(shapeForLayout(null, "carousel")).toBeNull();
  });
});
