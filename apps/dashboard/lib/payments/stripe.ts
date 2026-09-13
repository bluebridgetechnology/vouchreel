import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { plans, subscriptions } from "../db/schema";
import type {
  PaymentProvider,
  CheckoutParams,
  CheckoutSession,
  PortalSession,
  SubscriptionStatus,
  WebhookResult,
} from "./types";

/**
 * Maps Stripe subscription statuses to Vouchreel subscription statuses.
 */
export function mapStripeSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "paused":
      return "paused";
    default:
      return "active";
  }
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  private stripe: Stripe;

  constructor(customClient?: Stripe) {
    if (customClient) {
      this.stripe = customClient;
    } else {
      const apiKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";
      this.stripe = new Stripe(apiKey, {
        apiVersion: "2025-02-24.acacia" as any,
      });
    }
  }

  /**
   * Creates a Stripe Checkout session for a given plan.
   */
  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession> {
    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, params.planId),
    });

    if (!plan) {
      throw new Error(`Plan not found: ${params.planId}`);
    }

    const lineItem = plan.stripePriceId
      ? { price: plan.stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: "usd",
            product_data: {
              name: plan.name,
              metadata: { planId: plan.id },
            },
            unit_amount: plan.price,
            recurring: {
              interval: plan.interval as "month" | "year",
            },
          },
          quantity: 1,
        };

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: params.userEmail,
      client_reference_id: params.userId,
      line_items: [lineItem],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        userId: params.userId,
        planId: params.planId,
      },
      subscription_data: {
        metadata: {
          userId: params.userId,
          planId: params.planId,
        },
      },
    });

    if (!session.url) {
      throw new Error("Stripe checkout session created without a URL");
    }

    return {
      id: session.id,
      url: session.url,
    };
  }

  /**
   * Creates a customer portal session for an existing customer.
   */
  async createCustomerPortalSession(customerId: string): Promise<PortalSession> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings/billing`,
    });

    return {
      url: session.url,
    };
  }

  /**
   * Retrieves subscription status from Stripe.
   */
  async getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    return mapStripeSubscriptionStatus(subscription.status);
  }

  /**
   * Cancels a subscription at period end.
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Verifies and processes incoming Stripe webhook events.
   */
  async handleWebhook(request: Request): Promise<WebhookResult> {
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return {
        received: false,
        error: "Missing stripe-signature header or STRIPE_WEBHOOK_SECRET environment variable",
      };
    }

    const rawBody = await request.text();
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown verification error";
      return {
        received: false,
        error: `Stripe webhook signature verification failed: ${errorMessage}`,
      };
    }

    let actionTaken = "none";

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId || session.client_reference_id;
        const planId = session.metadata?.planId;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || null;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id || null;

        if (userId && planId) {
          // Check for existing subscription for this user
          const existing = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.userId, userId),
          });

          if (existing) {
            await db
              .update(subscriptions)
              .set({
                planId,
                status: "active",
                provider: "stripe",
                providerCustomerId: customerId,
                providerSubscriptionId: subscriptionId,
              })
              .where(eq(subscriptions.id, existing.id));
          } else {
            await db.insert(subscriptions).values({
              userId,
              planId,
              status: "active",
              provider: "stripe",
              providerCustomerId: customerId,
              providerSubscriptionId: subscriptionId,
            });
          }
          actionTaken = "subscription_created";
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = mapStripeSubscriptionStatus(sub.status);
        const periodEnd = (sub as any).current_period_end
          ? new Date((sub as any).current_period_end * 1000)
          : null;

        await db
          .update(subscriptions)
          .set({
            status,
            currentPeriodEnd: periodEnd,
          })
          .where(eq(subscriptions.providerSubscriptionId, sub.id));

        actionTaken = "subscription_updated";
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        await db
          .update(subscriptions)
          .set({
            status: "canceled",
          })
          .where(eq(subscriptions.providerSubscriptionId, sub.id));

        actionTaken = "subscription_canceled";
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as any).subscription;
        const subscriptionId =
          typeof subId === "string" ? subId : subId?.id;

        if (subscriptionId) {
          await db
            .update(subscriptions)
            .set({
              status: "past_due",
            })
            .where(eq(subscriptions.providerSubscriptionId, subscriptionId));

          actionTaken = "subscription_marked_past_due";
        }
        break;
      }

      default:
        actionTaken = `ignored_${event.type}`;
        break;
    }

    return {
      received: true,
      event: event.type,
      actionTaken,
    };
  }
}
