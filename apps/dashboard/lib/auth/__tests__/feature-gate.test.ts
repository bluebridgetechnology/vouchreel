import { describe, it, expect, vi, beforeEach } from "vitest";
import { canAccess } from "../feature-gate";
import { getSubscriptionLimits } from "@/lib/payments/subscription";

vi.mock("@/lib/payments/subscription", () => ({
  getSubscriptionLimits: vi.fn(),
  PLAN_LIMITS: {
    free: {
      tier: "free",
      maxSpaces: 1,
      maxTestimonialsPerSpace: 3,
      removeWatermark: false,
      canCustomizeBranding: false,
      canUseAllTriggers: false,
      canAccessAnalytics: false,
      canUseCustomRules: false,
      multiSeat: false,
      whiteLabel: false,
      exportableReports: false,
    },
    pro: {
      tier: "pro",
      maxSpaces: 5,
      maxTestimonialsPerSpace: Infinity,
      removeWatermark: true,
      canCustomizeBranding: true,
      canUseAllTriggers: true,
      canAccessAnalytics: true,
      canUseCustomRules: true,
      multiSeat: false,
      whiteLabel: false,
      exportableReports: true,
    },
    agency: {
      tier: "agency",
      maxSpaces: Infinity,
      maxTestimonialsPerSpace: Infinity,
      removeWatermark: true,
      canCustomizeBranding: true,
      canUseAllTriggers: true,
      canAccessAnalytics: true,
      canUseCustomRules: true,
      multiSeat: true,
      whiteLabel: true,
      exportableReports: true,
    },
  },
}));

describe("Feature Gating Helper (canAccess)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false if userId is invalid", async () => {
    expect(await canAccess("", "white-label")).toBe(false);
    expect(await canAccess(null as any, "multi-seat")).toBe(false);
  });

  describe("Free Tier User", () => {
    beforeEach(() => {
      (getSubscriptionLimits as any).mockResolvedValue({
        tier: "free",
        maxSpaces: 1,
        maxTestimonialsPerSpace: 3,
        removeWatermark: false,
        canAccessAnalytics: false,
        canUseCustomRules: false,
        multiSeat: false,
        whiteLabel: false,
        exportableReports: false,
      });
    });

    it("denies access to Agency and Pro features", async () => {
      expect(await canAccess("user-free", "white-label")).toBe(false);
      expect(await canAccess("user-free", "multi-seat")).toBe(false);
      expect(await canAccess("user-free", "agency-dashboard")).toBe(false);
      expect(await canAccess("user-free", "exportable-reports")).toBe(false);
      expect(await canAccess("user-free", "advanced-analytics")).toBe(false);
      expect(await canAccess("user-free", "remove-watermark")).toBe(false);
      expect(await canAccess("user-free", "unlimited-spaces")).toBe(false);
      expect(await canAccess("user-free", "unlimited-testimonials")).toBe(false);
    });
  });

  describe("Pro Tier User", () => {
    beforeEach(() => {
      (getSubscriptionLimits as any).mockResolvedValue({
        tier: "pro",
        maxSpaces: 5,
        maxTestimonialsPerSpace: Infinity,
        removeWatermark: true,
        canAccessAnalytics: true,
        canUseCustomRules: true,
        multiSeat: false,
        whiteLabel: false,
        exportableReports: true,
      });
    });

    it("allows access to Pro features but denies Agency-only features", async () => {
      // Pro features allowed:
      expect(await canAccess("user-pro", "remove-watermark")).toBe(true);
      expect(await canAccess("user-pro", "advanced-analytics")).toBe(true);
      expect(await canAccess("user-pro", "custom-rules")).toBe(true);
      expect(await canAccess("user-pro", "unlimited-testimonials")).toBe(true);
      expect(await canAccess("user-pro", "exportable-reports")).toBe(true);

      // Agency features denied:
      expect(await canAccess("user-pro", "white-label")).toBe(false);
      expect(await canAccess("user-pro", "multi-seat")).toBe(false);
      expect(await canAccess("user-pro", "agency-dashboard")).toBe(false);
      expect(await canAccess("user-pro", "unlimited-spaces")).toBe(false);
    });
  });

  describe("Agency Tier User", () => {
    beforeEach(() => {
      (getSubscriptionLimits as any).mockResolvedValue({
        tier: "agency",
        maxSpaces: Infinity,
        maxTestimonialsPerSpace: Infinity,
        removeWatermark: true,
        canAccessAnalytics: true,
        canUseCustomRules: true,
        multiSeat: true,
        whiteLabel: true,
        exportableReports: true,
      });
    });

    it("allows access to all features including Agency-only features", async () => {
      expect(await canAccess({ id: "user-agency" }, "white-label")).toBe(true);
      expect(await canAccess({ id: "user-agency" }, "multi-seat")).toBe(true);
      expect(await canAccess({ id: "user-agency" }, "agency-dashboard")).toBe(true);
      expect(await canAccess({ id: "user-agency" }, "exportable-reports")).toBe(true);
      expect(await canAccess({ id: "user-agency" }, "advanced-analytics")).toBe(true);
      expect(await canAccess({ id: "user-agency" }, "remove-watermark")).toBe(true);
      expect(await canAccess({ id: "user-agency" }, "unlimited-spaces")).toBe(true);
      expect(await canAccess({ id: "user-agency" }, "unlimited-testimonials")).toBe(true);
    });
  });
});
