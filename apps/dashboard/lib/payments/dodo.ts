import DodoPayments from "dodopayments";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { plans, subscriptions } from "../db/schema";
import { claimWebhookEvent, eventTimeOf, notNewerThan, releaseWebhookEvent } from "./webhook-guard";
import type {
  PaymentProvider,
  CheckoutParams,
  CheckoutSession,
  PortalSession,
  SubscriptionStatus,
  WebhookResult,
} from "./types";

/**
 * Maps Dodo Payments subscription statuses to Vouchreel subscription statuses.
 */
export function mapDodoSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "renewed":
      return "active";
    case "on_hold":
    case "past_due":
    case "failed":
      return "past_due";
    case "cancelled":
    case "expired":
      return "canceled";
    case "paused":
      return "paused";
    default:
      return "active";
  }
}

export class DodoProvider implements PaymentProvider {
  readonly name = "dodo" as const;
  private client: DodoPayments;

  constructor(customClient?: DodoPayments) {
    if (customClient) {
      this.client = customClient;
    } else {
      const apiKey = process.env.DODO_API_KEY || "dodo_placeholder_key";
      const isProduction = process.env.NODE_ENV === "production";
      this.client = new DodoPayments({
        bearerToken: apiKey,
        environment: isProduction ? "live_mode" : "test_mode",
      });
    }
  }

  /**
   * Creates a Dodo checkout session for a given plan.
   */
  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession> {
    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, params.planId),
    });

    if (!plan) {
      throw new Error(`Plan not found: ${params.planId}`);
    }

    const productId = plan.dodoProductId || `pdt_${plan.id}`;

    const session = await this.client.checkoutSessions.create({
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
        },
      ],
      customer: {
        email: params.userEmail,
        name: params.userName || params.userEmail.split("@")[0],
      },
      metadata: {
        userId: params.userId,
        planId: params.planId,
      },
      return_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    if (!session.checkout_url) {
      throw new Error("Dodo checkout session created without a checkout_url");
    }

    return {
      id: session.session_id,
      url: session.checkout_url,
    };
  }

  /**
   * Creates a customer portal session for an existing customer in Dodo Payments.
   */
  async createCustomerPortalSession(customerId: string): Promise<PortalSession> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const portal = await this.client.customers.customerPortal.create(
      customerId,
      {
        return_url: `${appUrl}/settings/billing`,
      }
    );

    return {
      url: portal.link,
    };
  }

  /**
   * Retrieves subscription status from Dodo Payments.
   */
  async getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus> {
    const subscription = await this.client.subscriptions.retrieve(subscriptionId);
    return mapDodoSubscriptionStatus(subscription.status);
  }

  /**
   * Cancels a subscription at next billing date.
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.client.subscriptions.update(subscriptionId, {
      cancel_at_next_billing_date: true,
      cancel_reason: "cancelled_by_customer",
    });
  }

  /**
   * Verifies and processes incoming Dodo Payments webhook events.
   */
  async handleWebhook(request: Request): Promise<WebhookResult> {
    const webhookKey = process.env.DODO_WEBHOOK_SECRET;

    if (!webhookKey) {
      return {
        received: false,
        error: "Missing DODO_WEBHOOK_SECRET environment variable",
      };
    }

    const rawBody = await request.text();
    const headersRecord: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headersRecord[key.toLowerCase()] = value;
    });

    let payload: any;

    try {
      payload = this.client.webhooks.unwrap(rawBody, {
        headers: headersRecord,
        key: webhookKey,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown verification error";
      return {
        received: false,
        error: `Dodo webhook signature verification failed: ${errorMessage}`,
      };
    }

    // Dodo follows the Standard Webhooks spec: the delivery id is the `webhook-id` header
    const eventId = headersRecord["webhook-id"] || null;
    if (!(await claimWebhookEvent("dodo", eventId))) {
      return { received: true, event: payload.type, actionTaken: "duplicate_ignored" };
    }

    try {
      return await this.applyEvent(payload, eventTimeOf(payload.timestamp ?? headersRecord["webhook-timestamp"]));
    } catch (err) {
      await releaseWebhookEvent("dodo", eventId);
      throw err;
    }
  }

  private async applyEvent(payload: any, eventTime: Date): Promise<WebhookResult> {
    const eventType = payload.type;
    const data = payload.data;
    let actionTaken = "none";
    const fresh = notNewerThan(eventTime);

    switch (eventType) {
      case "payment.succeeded":
      case "subscription.active": {
        const customerId = data?.customer?.customer_id || data?.customer_id;
        const subscriptionId = data?.subscription_id;
        const metadata = data?.metadata || {};
        const userId = metadata.userId;
        const planId = metadata.planId;

        if (userId && planId) {
          const existing = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.userId, userId),
          });

          if (existing) {
            await db
              .update(subscriptions)
              .set({
                planId,
                status: "active",
                provider: "dodo",
                providerCustomerId: customerId || existing.providerCustomerId,
                providerSubscriptionId: subscriptionId || existing.providerSubscriptionId,
                lastEventAt: eventTime,
              })
              .where(and(eq(subscriptions.id, existing.id), fresh));
          } else {
            await db.insert(subscriptions).values({
              userId,
              planId,
              status: "active",
              provider: "dodo",
              providerCustomerId: customerId,
              providerSubscriptionId: subscriptionId,
              lastEventAt: eventTime,
            });
          }
          actionTaken = "subscription_created";
        }
        break;
      }

      case "subscription.updated":
      case "subscription.renewed": {
        const subscriptionId = data?.subscription_id;
        const status = data?.status ? mapDodoSubscriptionStatus(data.status) : "active";
        const nextBilling = data?.next_billing_date ? new Date(data.next_billing_date) : null;

        if (subscriptionId) {
          await db
            .update(subscriptions)
            .set({
              status,
              currentPeriodEnd: nextBilling,
              lastEventAt: eventTime,
            })
            .where(and(eq(subscriptions.providerSubscriptionId, subscriptionId), fresh));

          actionTaken = "subscription_updated";
        }
        break;
      }

      case "subscription.cancelled": {
        const subscriptionId = data?.subscription_id;
        if (subscriptionId) {
          await db
            .update(subscriptions)
            .set({
              status: "canceled",
              lastEventAt: eventTime,
            })
            .where(and(eq(subscriptions.providerSubscriptionId, subscriptionId), fresh));

          actionTaken = "subscription_canceled";
        }
        break;
      }

      case "subscription.past_due":
      case "subscription.failed": {
        const subscriptionId = data?.subscription_id;
        if (subscriptionId) {
          await db
            .update(subscriptions)
            .set({
              status: "past_due",
              lastEventAt: eventTime,
            })
            .where(and(eq(subscriptions.providerSubscriptionId, subscriptionId), fresh));

          actionTaken = "subscription_marked_past_due";
        }
        break;
      }

      default:
        actionTaken = `ignored_${eventType}`;
        break;
    }

    return {
      received: true,
      event: eventType,
      actionTaken,
    };
  }
}
