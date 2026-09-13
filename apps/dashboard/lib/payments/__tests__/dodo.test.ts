import { describe, it, expect, vi, beforeEach } from "vitest";
import { DodoProvider, mapDodoSubscriptionStatus } from "../dodo";
import { db } from "../../db";

vi.mock("../../db", () => ({
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

describe("DodoProvider", () => {
  let mockDodoClient: any;
  let provider: DodoProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDodoClient = {
      checkoutSessions: {
        create: vi.fn(),
      },
      customers: {
        customerPortal: {
          create: vi.fn(),
        },
      },
      subscriptions: {
        retrieve: vi.fn(),
        update: vi.fn(),
      },
      webhooks: {
        unwrap: vi.fn(),
      },
    };

    provider = new DodoProvider(mockDodoClient);
  });

  describe("mapDodoSubscriptionStatus", () => {
    it("maps Dodo statuses correctly", () => {
      expect(mapDodoSubscriptionStatus("active")).toBe("active");
      expect(mapDodoSubscriptionStatus("renewed")).toBe("active");
      expect(mapDodoSubscriptionStatus("on_hold")).toBe("past_due");
      expect(mapDodoSubscriptionStatus("past_due")).toBe("past_due");
      expect(mapDodoSubscriptionStatus("failed")).toBe("past_due");
      expect(mapDodoSubscriptionStatus("cancelled")).toBe("canceled");
      expect(mapDodoSubscriptionStatus("expired")).toBe("canceled");
      expect(mapDodoSubscriptionStatus("paused")).toBe("paused");
      expect(mapDodoSubscriptionStatus("other")).toBe("active");
    });
  });

  describe("createCheckoutSession", () => {
    it("creates a Dodo checkout session with product ID and customer metadata", async () => {
      (db.query.plans.findFirst as any).mockResolvedValue({
        id: "plan-dodo-1",
        name: "Pro",
        dodoProductId: "pdt_123",
      });

      mockDodoClient.checkoutSessions.create.mockResolvedValue({
        session_id: "dodo_sess_123",
        checkout_url: "https://test.dodopayments.com/buy/dodo_sess_123",
      });

      const session = await provider.createCheckoutSession({
        planId: "plan-dodo-1",
        userId: "user-1",
        userEmail: "user@example.com",
        userName: "John Doe",
        successUrl: "https://example.com/checkout/success",
        cancelUrl: "https://example.com/checkout/cancel",
      });

      expect(session.id).toBe("dodo_sess_123");
      expect(session.url).toBe("https://test.dodopayments.com/buy/dodo_sess_123");
      expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          product_cart: [{ product_id: "pdt_123", quantity: 1 }],
          customer: {
            email: "user@example.com",
            name: "John Doe",
          },
          metadata: {
            userId: "user-1",
            planId: "plan-dodo-1",
          },
          return_url: "https://example.com/checkout/success",
          cancel_url: "https://example.com/checkout/cancel",
        })
      );
    });

    it("throws an error if the plan does not exist", async () => {
      (db.query.plans.findFirst as any).mockResolvedValue(null);

      await expect(
        provider.createCheckoutSession({
          planId: "missing",
          userId: "user-1",
          userEmail: "user@example.com",
          successUrl: "https://example.com/checkout/success",
          cancelUrl: "https://example.com/checkout/cancel",
        })
      ).rejects.toThrow("Plan not found: missing");
    });
  });

  describe("createCustomerPortalSession", () => {
    it("creates a customer portal link with return_url", async () => {
      mockDodoClient.customers.customerPortal.create.mockResolvedValue({
        link: "https://portal.dodopayments.com/p/test",
      });

      const portal = await provider.createCustomerPortalSession("cus_dodo_123");
      expect(portal.url).toBe("https://portal.dodopayments.com/p/test");
      expect(mockDodoClient.customers.customerPortal.create).toHaveBeenCalledWith(
        "cus_dodo_123",
        expect.objectContaining({
          return_url: expect.stringContaining("/settings/billing"),
        })
      );
    });
  });

  describe("getSubscriptionStatus", () => {
    it("retrieves and maps subscription status from Dodo Payments", async () => {
      mockDodoClient.subscriptions.retrieve.mockResolvedValue({
        subscription_id: "sub_dodo_123",
        status: "active",
      });

      const status = await provider.getSubscriptionStatus("sub_dodo_123");
      expect(status).toBe("active");
      expect(mockDodoClient.subscriptions.retrieve).toHaveBeenCalledWith(
        "sub_dodo_123"
      );
    });
  });

  describe("cancelSubscription", () => {
    it("updates subscription to cancel at next billing date", async () => {
      mockDodoClient.subscriptions.update.mockResolvedValue({
        subscription_id: "sub_dodo_123",
      });

      await provider.cancelSubscription("sub_dodo_123");
      expect(mockDodoClient.subscriptions.update).toHaveBeenCalledWith(
        "sub_dodo_123",
        {
          cancel_at_next_billing_date: true,
          cancel_reason: "cancelled_by_customer",
        }
      );
    });
  });

  describe("handleWebhook", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        DODO_WEBHOOK_SECRET: "dodo_wh_secret",
      };
    });

    it("returns error if DODO_WEBHOOK_SECRET is not set", async () => {
      delete process.env.DODO_WEBHOOK_SECRET;

      const request = new Request("http://localhost/api/webhooks/dodo", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(false);
      expect(result.error).toContain("Missing DODO_WEBHOOK_SECRET");
    });

    it("returns error if unwrap fails (invalid signature)", async () => {
      mockDodoClient.webhooks.unwrap.mockImplementation(() => {
        throw new Error("Invalid webhook signature");
      });

      const request = new Request("http://localhost/api/webhooks/dodo", {
        method: "POST",
        headers: { "webhook-signature": "bad_sig" },
        body: "payload",
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(false);
      expect(result.error).toContain("Dodo webhook signature verification failed");
    });

    it("handles payment.succeeded and creates subscription", async () => {
      mockDodoClient.webhooks.unwrap.mockReturnValue({
        type: "payment.succeeded",
        data: {
          customer_id: "cus_dodo_1",
          subscription_id: "sub_dodo_1",
          metadata: {
            userId: "user-abc",
            planId: "plan-pro",
          },
        },
      });

      (db.query.subscriptions.findFirst as any).mockResolvedValue(null);

      const request = new Request("http://localhost/api/webhooks/dodo", {
        method: "POST",
        body: "payload",
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(true);
      expect(result.actionTaken).toBe("subscription_created");
      expect(db.insert).toHaveBeenCalled();
    });

    it("handles subscription.updated", async () => {
      mockDodoClient.webhooks.unwrap.mockReturnValue({
        type: "subscription.updated",
        data: {
          subscription_id: "sub_dodo_1",
          status: "active",
          next_billing_date: "2026-10-01T00:00:00Z",
        },
      });

      const request = new Request("http://localhost/api/webhooks/dodo", {
        method: "POST",
        body: "payload",
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(true);
      expect(result.actionTaken).toBe("subscription_updated");
      expect(db.update).toHaveBeenCalled();
    });

    it("handles subscription.cancelled", async () => {
      mockDodoClient.webhooks.unwrap.mockReturnValue({
        type: "subscription.cancelled",
        data: {
          subscription_id: "sub_dodo_1",
        },
      });

      const request = new Request("http://localhost/api/webhooks/dodo", {
        method: "POST",
        body: "payload",
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(true);
      expect(result.actionTaken).toBe("subscription_canceled");
      expect(db.update).toHaveBeenCalled();
    });

    it("handles subscription.past_due", async () => {
      mockDodoClient.webhooks.unwrap.mockReturnValue({
        type: "subscription.past_due",
        data: {
          subscription_id: "sub_dodo_1",
        },
      });

      const request = new Request("http://localhost/api/webhooks/dodo", {
        method: "POST",
        body: "payload",
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(true);
      expect(result.actionTaken).toBe("subscription_marked_past_due");
      expect(db.update).toHaveBeenCalled();
    });
  });
});
