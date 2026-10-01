/**
 * Parameters required to create a checkout session.
 */
export interface CheckoutParams {
  planId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Result returned from creating a checkout session.
 */
export interface CheckoutSession {
  id: string;
  url: string;
}

/**
 * Result returned from creating a customer portal session.
 */
export interface PortalSession {
  url: string;
}

/**
 * Normalized subscription statuses supported by Vouchreel.
 * Maps directly to the `subscription_status` database enum.
 */
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "trialing"
  | "incomplete"
  | "paused";

/**
 * Result of processing a webhook request.
 */
export interface WebhookResult {
  received: boolean;
  event?: string;
  actionTaken?: string;
  error?: string;
}

/**
 * Supported payment provider identifiers.
 */
export type PaymentProviderName = "stripe" | "dodo";

/**
 * Unified payment provider interface implemented by both
 * StripeProvider and DodoProvider.
 */
export interface PaymentProvider {
  /**
   * The name identifier of this payment provider.
   */
  readonly name: PaymentProviderName;

  /**
   * Creates a checkout session for subscribing to a given plan.
   */
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession>;

  /**
   * Creates a customer portal session for managing an existing subscription.
   */
  createCustomerPortalSession(customerId: string): Promise<PortalSession>;

  /**
   * Queries the provider for current subscription status.
   */
  getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus>;

  /**
   * Cancels a subscription (typically at period end).
   */
  cancelSubscription(subscriptionId: string): Promise<void>;

  /**
   * Verifies and handles an incoming webhook request from the provider.
   */
  handleWebhook(request: Request): Promise<WebhookResult>;
}
