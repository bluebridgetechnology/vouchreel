import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LivePreview } from "../live-preview";
import { DEFAULT_WIDGET_CONFIG, TRIGGER_TYPES, WIDGET_TEMPLATES, WIDGET_POSITIONS, type TriggerType, type WidgetTemplate } from "@/lib/validations/widget-config";

/**
 * The widget page's live preview, rendered to markup in every template, theme and trigger. These snapshots were
 * recorded before the file was split into parts (B14): they are the proof that splitting it changed nothing.
 * (What happens after a click, such as the video and review modals, is covered by the browser test.)
 */
const render = (over: Partial<Parameters<typeof LivePreview>[0]> = {}) =>
  renderToStaticMarkup(
    <LivePreview
      template="floating-card"
      position={DEFAULT_WIDGET_CONFIG.position}
      theme={DEFAULT_WIDGET_CONFIG.theme}
      triggerType={DEFAULT_WIDGET_CONFIG.triggerType}
      triggerValue={DEFAULT_WIDGET_CONFIG.triggerValue}
      autoplayPreview={true}
      {...over}
    />
  );

describe("LivePreview markup", () => {
  for (const template of WIDGET_TEMPLATES) {
    it(`${template}: light`, () => {
      expect(render({ template: template as WidgetTemplate })).toMatchSnapshot();
    });
    it(`${template}: dark with another colour and radius`, () => {
      expect(render({ template: template as WidgetTemplate, theme: { ...DEFAULT_WIDGET_CONFIG.theme, mode: "dark", primaryColor: "#0a7d5a", borderRadius: 4 } })).toMatchSnapshot();
    });
  }

  for (const position of WIDGET_POSITIONS) {
    it(`position ${position}`, () => {
      expect(render({ position })).toMatchSnapshot();
    });
  }

  for (const triggerType of TRIGGER_TYPES) {
    it(`trigger ${triggerType} says what it does`, () => {
      expect(render({ triggerType: triggerType as TriggerType, triggerValue: {} })).toMatchSnapshot();
    });
  }

  it("autoplay off, with and without a handler", () => {
    expect(render({ autoplayPreview: false })).toMatchSnapshot();
    expect(render({ autoplayPreview: false, onAutoplayChange: () => {} })).toMatchSnapshot();
  });

  it("the trigger label reads the value it is given", () => {
    expect(render({ triggerType: "delay", triggerValue: { seconds: 9 } })).toContain("Trigger: 9s delay");
    expect(render({ triggerType: "scroll-depth", triggerValue: { percentage: 70 } })).toContain("Trigger: 70% scroll");
    expect(render({ triggerType: "pageview-count", triggerValue: { count: 4 } })).toContain("Trigger: 4 pageviews");
    expect(render({ triggerType: "exit-intent" })).toContain("Trigger: Exit intent");
  });
});
