import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getUserSubscription,
  hasActiveSubscription,
  getSubscriptionLimits,
  canCreateSpace,
  canAddTestimonial,
} from "../subscription";
import { db } from "../../db";

vi.mock("../../db", () => ({
  db: {
    query: {
      subscriptions: {
        findFirst: vi.fn(),
      },
      plans: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe("Subscription Feature Gating Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserSubscription", () => {
    it("returns null if no subscription exists for user", async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue(null);

      const result = await getUserSubscription("user-1");
      expect(result).toBeNull();
    });

    it("returns subscription and plan if found", async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        id: "sub-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
      });

      (db.query.plans.findFirst as any).mockResolvedValue({
        id: "plan-1",
        name: "Pro",
        price: 1900,
      });

      const result = await getUserSubscription("user-1");
      expect(result).not.toBeNull();
      expect(result?.subscription.id).toBe("sub-1");
      expect(result?.plan?.name).toBe("Pro");
    });
  });

  describe("hasActiveSubscription", () => {
    it("returns false if user has no subscription record", async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue(null);
      expect(await hasActiveSubscription("user-1")).toBe(false);
    });

    it("returns true for 'active' subscription", async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        status: "active",
      });
      expect(await hasActiveSubscription("user-1")).toBe(true);
    });

    it("returns true for 'trialing' subscription", async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        status: "trialing",
      });
      expect(await hasActiveSubscription("user-1")).toBe(true);
    });

    it("returns false for 'past_due' or 'canceled' subscription", async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        status: "past_due",
      });
      expect(await hasActiveSubscription("user-1")).toBe(false);

      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        status: "canceled",
      });
      expect(await hasActiveSubscription("user-1")).toBe(false);
    });
  });

  describe("getSubscriptionLimits & feature gates", () => {
    it("returns Free tier limits if no subscription exists", async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue(null);

      const limits = await getSubscriptionLimits("user-1");
      expect(limits.tier).toBe("free");
      expect(limits.maxSpaces).toBe(1);
      expect(limits.maxTestimonialsPerSpace).toBe(3);
      expect(limits.removeWatermark).toBe(false);
    });

    it("returns Pro tier limits for active Pro subscriber", async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        planId: "plan-pro",
        status: "active",
      });

      (db.query.plans.findFirst as any).mockResolvedValue({
        id: "plan-pro",
        name: "Pro Monthly",
      });

      const limits = await getSubscriptionLimits("user-1");
      expect(limits.tier).toBe("pro");
      expect(limits.maxSpaces).toBe(5);
      expect(limits.maxTestimonialsPerSpace).toBe(Infinity);
      expect(limits.removeWatermark).toBe(true);
      expect(limits.canAccessAnalytics).toBe(true);
      expect(limits.multiSeat).toBe(false);
      expect(limits.whiteLabel).toBe(false);
    });

    it("returns Agency tier limits for active Agency subscriber", async () => {
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        planId: "plan-agency",
        status: "active",
      });

      (db.query.plans.findFirst as any).mockResolvedValue({
        id: "plan-agency",
        name: "Agency Monthly",
      });

      const limits = await getSubscriptionLimits("user-1");
      expect(limits.tier).toBe("agency");
      expect(limits.maxSpaces).toBe(Infinity);
      expect(limits.maxTestimonialsPerSpace).toBe(Infinity);
      expect(limits.removeWatermark).toBe(true);
      expect(limits.canAccessAnalytics).toBe(true);
      expect(limits.multiSeat).toBe(true);
      expect(limits.whiteLabel).toBe(true);
      expect(limits.exportableReports).toBe(true);
    });

    it("correctly gates space creation based on limits", async () => {
      // Free tier: 1 max space
      (db.query.subscriptions.findFirst as any).mockResolvedValue(null);

      expect(await canCreateSpace("user-1", 0)).toBe(true);
      expect(await canCreateSpace("user-1", 1)).toBe(false);
    });

    it("correctly gates testimonial creation based on limits", async () => {
      // Free tier: 3 max testimonials
      (db.query.subscriptions.findFirst as any).mockResolvedValue(null);

      expect(await canAddTestimonial("user-1", 2)).toBe(true);
      expect(await canAddTestimonial("user-1", 3)).toBe(false);
    });
  });
});
