import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as stripeWebhookHandler } from "../../../app/api/webhooks/stripe/route";
import { POST as dodoWebhookHandler } from "../../../app/api/webhooks/dodo/route";

vi.mock("@/lib/payments/stripe", () => {
  return {
    StripeProvider: class {
      handleWebhook = vi.fn(async (req: Request) => {
        if (!req.headers.get("stripe-signature")) {
          return { received: false, error: "Missing signature" };
        }
        return {
          received: true,
          event: "checkout.session.completed",
          actionTaken: "subscription_created",
        };
      });
    },
  };
});

vi.mock("@/lib/payments/dodo", () => {
  return {
    DodoProvider: class {
      handleWebhook = vi.fn(async (req: Request) => {
        if (!req.headers.get("webhook-signature")) {
          return { received: false, error: "Missing signature" };
        }
        return {
          received: true,
          event: "payment.succeeded",
          actionTaken: "subscription_created",
        };
      });
    },
  };
});

describe("Webhook Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/webhooks/stripe", () => {
    it("returns 400 when signature is missing", async () => {
      const request = new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toBe("Missing signature");
    });

    it("returns 200 when webhook processing succeeds", async () => {
      const request = new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid_sig" },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.received).toBe(true);
      expect(json.event).toBe("checkout.session.completed");
    });
  });

  describe("POST /api/webhooks/dodo", () => {
    it("returns 400 when signature is missing", async () => {
      const request = new Request("http://localhost/api/webhooks/dodo", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await dodoWebhookHandler(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toBe("Missing signature");
    });

    it("returns 200 when webhook processing succeeds", async () => {
      const request = new Request("http://localhost/api/webhooks/dodo", {
        method: "POST",
        headers: { "webhook-signature": "valid_sig" },
        body: JSON.stringify({ type: "payment.succeeded" }),
      });

      const response = await dodoWebhookHandler(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.received).toBe(true);
      expect(json.event).toBe("payment.succeeded");
    });
  });
});
