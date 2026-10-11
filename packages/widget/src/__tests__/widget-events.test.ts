import { describe, expect, it, vi } from "vitest";
import { VouchreelWidget } from "../widget";

const track = (widgetId?: string) => {
  const analytics = { track: vi.fn() };
  const widget = new VouchreelWidget({ embedKey: "k", config: {}, testimonials: [], analytics: analytics as any, widgetId }) as any;
  return { analytics, widget };
};

describe("a widget says which widget an event came from", () => {
  it("adds its own id to everything it records", () => {
    const { analytics, widget } = track("w-1");
    widget.track("impression", "t1");
    widget.track("click", "t1");
    widget.track("play", "t2");
    expect(analytics.track.mock.calls).toEqual([
      ["impression", "t1", { widgetId: "w-1" }],
      ["click", "t1", { widgetId: "w-1" }],
      ["play", "t2", { widgetId: "w-1" }],
    ]);
  });

  it("adds nothing when the widget has no id (the default widget of a space with none saved)", () => {
    const { analytics, widget } = track();
    widget.track("click", "t1");
    expect(analytics.track).toHaveBeenCalledWith("click", "t1", null);
  });

  it("does nothing without analytics", () => {
    const widget = new VouchreelWidget({ embedKey: "k", config: {}, testimonials: [] }) as any;
    expect(() => widget.track("click", "t1")).not.toThrow();
  });
});
