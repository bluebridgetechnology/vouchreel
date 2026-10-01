import { describe, it, expect, vi, beforeEach } from "vitest";
import { StripeProvider, mapStripeSubscriptionStatus } from "../stripe";
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

describe("StripeProvider", () => {
  let mockStripe: any;
  let provider: StripeProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStripe = {
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
      billingPortal: {
        sessions: {
          create: vi.fn(),
        },
      },
      subscriptions: {
        retrieve: vi.fn(),
        update: vi.fn(),
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    };

    provider = new StripeProvider(mockStripe);
  });

  describe("mapStripeSubscriptionStatus", () => {
    it("maps Stripe statuses correctly", () => {
      expect(mapStripeSubscriptionStatus("active")).toBe("active");
      expect(mapStripeSubscriptionStatus("trialing")).toBe("trialing");
      expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
      expect(mapStripeSubscriptionStatus("unpaid")).toBe("past_due");
      expect(mapStripeSubscriptionStatus("canceled")).toBe("canceled");
      expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("canceled");
      expect(mapStripeSubscriptionStatus("incomplete")).toBe("incomplete");
      expect(mapStripeSubscriptionStatus("paused")).toBe("paused");
      expect(mapStripeSubscriptionStatus("unknown_status")).toBe("active");
    });
  });

  describe("createCheckoutSession", () => {
    it("creates a checkout session using price ID if present", async () => {
      (db.query.plans.findFirst as any).mockResolvedValue({
        id: "plan-123",
        name: "Pro",
        price: 1900,
        interval: "month",
        stripePriceId: "price_stripe_123",
      });

      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
      });

      const session = await provider.createCheckoutSession({
        planId: "plan-123",
        userId: "user-456",
        userEmail: "user@example.com",
        successUrl: "https://example.com/checkout/success",
        cancelUrl: "https://example.com/checkout/cancel",
      });

      expect(session.id).toBe("cs_test_123");
      expect(session.url).toBe("https://checkout.stripe.com/c/pay/cs_test_123");
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          customer_email: "user@example.com",
          client_reference_id: "user-456",
          line_items: [{ price: "price_stripe_123", quantity: 1 }],
          success_url: "https://example.com/checkout/success",
          cancel_url: "https://example.com/checkout/cancel",
        })
      );
    });

    it("throws an error if the plan is not found", async () => {
      (db.query.plans.findFirst as any).mockResolvedValue(null);

      await expect(
        provider.createCheckoutSession({
          planId: "nonexistent",
          userId: "user-456",
          userEmail: "user@example.com",
          successUrl: "https://example.com/checkout/success",
          cancelUrl: "https://example.com/checkout/cancel",
        })
      ).rejects.toThrow("Plan not found: nonexistent");
    });
  });

  describe("createCustomerPortalSession", () => {
    it("creates a portal session with return_url", async () => {
      mockStripe.billingPortal.sessions.create.mockResolvedValue({
        url: "https://billing.stripe.com/p/session_123",
      });

      const portal = await provider.createCustomerPortalSession("cus_123");
      expect(portal.url).toBe("https://billing.stripe.com/p/session_123");
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: "cus_123",
        return_url: expect.stringContaining("/settings/billing"),
      });
    });
  });

  describe("getSubscriptionStatus", () => {
    it("retrieves and maps subscription status from Stripe", async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: "sub_123",
        status: "active",
      });

      const status = await provider.getSubscriptionStatus("sub_123");
      expect(status).toBe("active");
      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
    });
  });

  describe("cancelSubscription", () => {
    it("cancels subscription at period end", async () => {
      mockStripe.subscriptions.update.mockResolvedValue({
        id: "sub_123",
        cancel_at_period_end: true,
      });

      await provider.cancelSubscription("sub_123");
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
        cancel_at_period_end: true,
      });
    });
  });

  describe("handleWebhook", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
      };
    });

    it("returns error if stripe-signature header is missing", async () => {
      const request = new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(false);
      expect(result.error).toContain("Missing stripe-signature header");
    });

    it("returns error if signature verification fails", async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const request = new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "invalid_sig" },
        body: "test_payload",
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(false);
      expect(result.error).toContain("Stripe webhook signature verification failed");
    });

    it("handles checkout.session.completed and creates subscription", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_123",
            metadata: {
              userId: "user-1",
              planId: "plan-pro",
            },
          },
        },
      });

      (db.query.subscriptions.findFirst as any).mockResolvedValue(null);

      const request = new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid_sig" },
        body: "payload",
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(true);
      expect(result.actionTaken).toBe("subscription_created");
      expect(db.insert).toHaveBeenCalled();
    });

    it("handles customer.subscription.updated", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            status: "active",
            current_period_end: 1735689600,
          },
        },
      });

      const request = new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid_sig" },
        body: "payload",
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(true);
      expect(result.actionTaken).toBe("subscription_updated");
      expect(db.update).toHaveBeenCalled();
    });

    it("handles customer.subscription.deleted", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_123",
          },
        },
      });

      const request = new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid_sig" },
        body: "payload",
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(true);
      expect(result.actionTaken).toBe("subscription_canceled");
      expect(db.update).toHaveBeenCalled();
    });

    it("handles invoice.payment_failed", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: "invoice.payment_failed",
        data: {
          object: {
            subscription: "sub_123",
          },
        },
      });

      const request = new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid_sig" },
        body: "payload",
      });

      const result = await provider.handleWebhook(request);
      expect(result.received).toBe(true);
      expect(result.actionTaken).toBe("subscription_marked_past_due");
      expect(db.update).toHaveBeenCalled();
    });
  });
});
