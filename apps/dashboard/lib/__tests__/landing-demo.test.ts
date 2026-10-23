import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANDING_DEMO_CONTENT, LANDING_DEMO_LAYOUTS, landingDemoDraft } from "../landing-demo";
import { WIDGET_TEMPLATES } from "../validations/widget-config";

const publicDir = path.resolve(__dirname, "../../public");

describe("landing demo", () => {
  it("is marked as sample content and has no reviews to badge as Google or Trustpilot", () => {
    expect(LANDING_DEMO_CONTENT.sample).toBe(true);
    expect(LANDING_DEMO_CONTENT.reviews).toHaveLength(0);
  });

  it("points every testimonial at a video and poster that ship in public/", () => {
    for (const t of LANDING_DEMO_CONTENT.testimonials) {
      expect(existsSync(path.join(publicDir, t.videoUrl))).toBe(true);
      expect(existsSync(path.join(publicDir, String(t.thumbnailUrl)))).toBe(true);
    }
  });

  it("offers only real layouts, and not the reviews-only rating badge", () => {
    for (const id of LANDING_DEMO_LAYOUTS) expect(WIDGET_TEMPLATES).toContain(id);
    expect(LANDING_DEMO_LAYOUTS).not.toContain("rating-badge");
  });

  it("hides the widget's quote, since the sample videos already show it", () => {
    expect(landingDemoDraft("carousel").theme.showQuote).toBe(false);
  });
});
