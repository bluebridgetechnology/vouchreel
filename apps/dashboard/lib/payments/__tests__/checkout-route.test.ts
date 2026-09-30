import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as checkoutHandler } from "../../../app/api/checkout/route";
import { POST as customerPortalHandler } from "../../../app/api/customer-portal/route";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getPaymentProvider, createPaymentProvider } from "@/lib/payments";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      plans: {
        findFirst: vi.fn(),
      },
      subscriptions: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

vi.mock("@/lib/payments", () => ({
  getPaymentProvider: vi.fn(),
  createPaymentProvider: vi.fn(),
}));

describe("Checkout and Customer Portal Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/checkout", () => {
    it("returns 401 if unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const req = new Request("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "plan-1" }),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 if planId is missing", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      const req = new Request("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 if plan does not exist", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });
      (db.query.plans.findFirst as any).mockResolvedValue(null);

      const req = new Request("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "missing-plan" }),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(404);
    });

    it("activates free plan immediately without third-party checkout", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });
      (db.query.plans.findFirst as any).mockResolvedValue({
        id: "plan-free",
        name: "Free",
        price: 0,
      });
      (db.query.subscriptions.findFirst as any).mockResolvedValue(null);

      const req = new Request("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "plan-free" }),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.url).toContain("/checkout/success?plan=free");
      expect(db.insert).toHaveBeenCalled();
    });

    it("initiates paid checkout session with active provider", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com", name: "Alice" },
      });
      (db.query.plans.findFirst as any).mockResolvedValue({
        id: "plan-pro",
        name: "Pro",
        price: 1900,
      });

      const mockProvider = {
        name: "stripe",
        createCheckoutSession: vi.fn().mockResolvedValue({
          id: "cs_123",
          url: "https://checkout.stripe.com/pay/cs_123",
        }),
      };
      (getPaymentProvider as any).mockResolvedValue(mockProvider);

      const req = new Request("http://localhost/api/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "plan-pro" }),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.url).toBe("https://checkout.stripe.com/pay/cs_123");
      expect(mockProvider.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: "plan-pro",
          userId: "user-1",
        })
      );
    });
  });

  describe("POST /api/customer-portal", () => {
    it("returns 401 if unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const res = await customerPortalHandler();
      expect(res.status).toBe(401);
    });

    it("returns 400 if user has no providerCustomerId", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1" },
      });
      (db.query.subscriptions.findFirst as any).mockResolvedValue(null);

      const res = await customerPortalHandler();
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.message).toContain("No active paid subscription found");
    });

    it("returns customer portal URL when user has subscription", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1" },
      });
      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        userId: "user-1",
        provider: "stripe",
        providerCustomerId: "cus_123",
      });

      const mockProvider = {
        createCustomerPortalSession: vi.fn().mockResolvedValue({
          url: "https://billing.stripe.com/p/session_123",
        }),
      };
      (createPaymentProvider as any).mockReturnValue(mockProvider);

      const res = await customerPortalHandler();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.url).toBe("https://billing.stripe.com/p/session_123");
      expect(mockProvider.createCustomerPortalSession).toHaveBeenCalledWith(
        "cus_123"
      );
    });
  });
});
