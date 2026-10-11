import { describe, expect, it } from "vitest";
import { buildPreviewMessage, DEVICES, fitScale, previewContentFrom, SAMPLE_CONTENT, triggerLabel } from "../widget-preview";
import { DEFAULT_WIDGET_CONFIG } from "@/lib/validations/widget-config";

describe("widget preview", () => {
  it("builds the message preview.js listens for, with the draft as the widget's config", () => {
    const draft = { template: "carousel" as const, position: "bottom-left" as const, theme: DEFAULT_WIDGET_CONFIG.theme, autoplayPreview: false };
    const message = buildPreviewMessage(draft, SAMPLE_CONTENT, { dark: true });
    expect(message).toEqual({
      type: "vouchreel:preview",
      config: { template: "carousel", position: "bottom-left", theme: DEFAULT_WIDGET_CONFIG.theme, autoplayPreview: false },
      testimonials: SAMPLE_CONTENT.testimonials,
      reviews: SAMPLE_CONTENT.reviews,
      whiteLabel: undefined,
      page: { dark: true },
    });
  });

  it("fits a device into the space available, never enlarging it", () => {
    expect(fitScale({ width: 640, height: 2000 }, DEVICES.desktop)).toBe(0.5);
    expect(fitScale({ width: 2000, height: 370 }, DEVICES.mobile)).toBe(0.5);
    expect(fitScale({ width: 4000, height: 4000 }, DEVICES.mobile)).toBe(1);
    expect(fitScale({ width: 0, height: 0 }, DEVICES.desktop)).toBe(1);
  });

  it("shows the space's own published items, and samples only when there are none", () => {
    const real = previewContentFrom({ testimonials: [{ id: "t", videoUrl: "v", platform: "mp4" }], reviews: [], whiteLabel: { removeBranding: true } });
    expect(real.sample).toBe(false);
    expect(real.testimonials).toHaveLength(1);
    expect(real.whiteLabel).toEqual({ removeBranding: true });

    const empty = previewContentFrom({ testimonials: [], reviews: [], whiteLabel: { removeBranding: true } });
    expect(empty.sample).toBe(true);
    expect(empty.testimonials).toBe(SAMPLE_CONTENT.testimonials);
    expect(empty.whiteLabel).toEqual({ removeBranding: true }); // white-label still applies to samples

    expect(previewContentFrom(null).sample).toBe(true);
  });

  it("samples need no outside image host (posters are inline SVG)", () => {
    for (const t of SAMPLE_CONTENT.testimonials) expect(t.thumbnailUrl).toMatch(/^data:image\/svg\+xml/);
  });

  it("says when the widget would appear", () => {
    expect(triggerLabel("delay", { seconds: 9 })).toBe("Trigger: 9s delay");
    expect(triggerLabel("scroll-depth", { percentage: 70 })).toBe("Trigger: 70% scroll");
    expect(triggerLabel("pageview-count", { count: 4 })).toBe("Trigger: 4 pageviews");
    expect(triggerLabel("exit-intent", {})).toBe("Trigger: Exit intent");
    expect(triggerLabel("returning-visitor", {})).toBe("Trigger: Returning visitor");
  });
});
