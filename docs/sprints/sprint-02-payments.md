# Sprint 2: Payments

**Phase**: MVP (Phase 1)
**Estimated effort**: 2–3 days
**Dependencies**: Sprint 1 (database, auth)
**Goal**: Implement the dual payment provider system (Stripe + Dodo Payments) with an admin toggle, subscription plans, pricing page, checkout flow, and webhook handlers. After this sprint, a user can view pricing, subscribe, and the system tracks their subscription status.

---

## Tasks

### Task 2.1 — Payment Provider Abstraction

Build the interface and factory for switching between Stripe and Dodo.

- [x] Create `apps/dashboard/lib/payments/types.ts` — shared types
  ```typescript
  interface PaymentProvider {
    createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession>
    createCustomerPortalSession(customerId: string): Promise<PortalSession>
    getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus>
    cancelSubscription(subscriptionId: string): Promise<void>
    handleWebhook(request: Request): Promise<WebhookResult>
  }
  ```
- [x] Create `apps/dashboard/lib/payments/index.ts` — factory that reads active provider from `adminSettings` table
- [x] Write unit tests for the factory function

**Expected Outcomes:**
- [x] `PaymentProvider` interface is fully typed
- [x] Factory reads `adminSettings` key `payment_provider` and returns the correct implementation
- [x] Default is `stripe` if no setting exists
- [x] Unit tests verify factory behavior

---

### Task 2.2 — Stripe Provider Implementation

- [x] Install `stripe` npm package
- [x] Create `apps/dashboard/lib/payments/stripe.ts` implementing `PaymentProvider`
- [x] Implement `createCheckoutSession` — creates a Stripe Checkout session with price ID + success/cancel URLs
- [x] Implement `createCustomerPortalSession` — for managing existing subscriptions
- [x] Implement `getSubscriptionStatus` — queries Stripe for subscription status
- [x] Implement `cancelSubscription` — cancels at period end
- [x] Implement `handleWebhook` — verifies Stripe signature, processes events:
  - `checkout.session.completed` → create/update subscription in DB
  - `customer.subscription.updated` → update status
  - `customer.subscription.deleted` → mark cancelled
  - `invoice.payment_failed` → mark past_due
- [x] Add `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` to `.env.example`

**Expected Outcomes:**
- [x] Stripe checkout session can be created (test with Stripe test mode)
- [x] Webhook handler correctly parses and verifies Stripe events
- [x] Subscription status is persisted to the `subscriptions` table
- [x] All Stripe env vars are documented

---

### Task 2.3 — Dodo Payments Provider Implementation

- [x] Install Dodo Payments SDK (or use their REST API directly)
- [x] Create `apps/dashboard/lib/payments/dodo.ts` implementing `PaymentProvider`
- [x] Implement `createCheckoutSession` — creates a Dodo checkout/payment link
- [x] Implement `createCustomerPortalSession` — Dodo equivalent or redirect
- [x] Implement `getSubscriptionStatus` — queries Dodo API
- [x] Implement `cancelSubscription`
- [x] Implement `handleWebhook` — verifies Dodo webhook signature, processes events:
  - Payment succeeded → create/update subscription
  - Subscription updated/cancelled → update status
- [x] Add `DODO_API_KEY`, `DODO_WEBHOOK_SECRET` to `.env.example`

**Expected Outcomes:**
- [x] Dodo provider implements all `PaymentProvider` methods
- [x] Webhook handler correctly verifies and processes Dodo events
- [x] All Dodo env vars are documented

---

### Task 2.4 — Webhook API Routes

- [x] Create `apps/dashboard/app/api/webhooks/stripe/route.ts`
  - Reads raw body, verifies signature, delegates to `StripeProvider.handleWebhook`
  - Returns 200 on success, 400 on invalid signature
- [x] Create `apps/dashboard/app/api/webhooks/dodo/route.ts`
  - Same pattern for Dodo webhooks
- [x] Both routes should always be active (even if provider is not currently selected) to avoid missing events during provider switches

**Expected Outcomes:**
- [x] `POST /api/webhooks/stripe` accepts and processes Stripe webhook events
- [x] `POST /api/webhooks/dodo` accepts and processes Dodo webhook events
- [x] Invalid signatures return 400
- [x] Valid events update the `subscriptions` table

---

### Task 2.5 — Pricing Page

- [x] Seed the `plans` table with initial plans (e.g., Free, Pro, Business) via a seed script or migration
- [x] Create `apps/dashboard/app/(marketing)/pricing/page.tsx`
  - Fetch plans from DB
  - Display plan comparison cards (name, price, features, CTA button)
  - Monthly/yearly toggle (if applicable)
- [x] Style with shadcn/ui Card components + Tailwind
- [x] CTA button triggers checkout (see Task 2.6)

**Expected Outcomes:**
- [x] `/pricing` renders plan cards with correct data from the database
- [x] Plans show features, pricing, and a subscribe button
- [x] Page is responsive on mobile

---

### Task 2.6 — Checkout Flow & Subscription Management

- [x] Create `apps/dashboard/app/api/checkout/route.ts`
  - Accepts `planId` in request body
  - Reads active payment provider from `adminSettings`
  - Calls `createCheckoutSession` on the active provider
  - Returns the checkout URL
- [x] Create `apps/dashboard/app/(dashboard)/settings/billing/page.tsx`
  - Shows current plan and subscription status
  - "Manage subscription" button → creates customer portal session
  - "Change plan" → redirects to pricing
- [x] Create `apps/dashboard/app/(marketing)/checkout/success/page.tsx` — post-checkout success page
- [x] Create `apps/dashboard/app/(marketing)/checkout/cancel/page.tsx` — checkout cancelled page
- [x] Add subscription status check middleware/helper for feature gating

**Expected Outcomes:**
- [x] Clicking "Subscribe" on pricing page creates a checkout session and redirects
- [x] After successful payment, subscription is recorded in DB
- [x] Billing settings page shows current plan status
- [x] Manage subscription opens provider's customer portal
- [x] Feature gating helper can check if user has active subscription

---

### Task 2.7 — Admin Provider Toggle

- [x] Create `apps/dashboard/app/(dashboard)/admin/page.tsx` (admin-only)
  - Dropdown to select active payment provider (Stripe / Dodo)
  - Saves to `adminSettings` table (key: `payment_provider`)
  - Only accessible to users with `owner` role (or a hardcoded admin email for now)
- [x] Create `apps/dashboard/app/api/admin/settings/route.ts`
  - GET: returns current admin settings
  - PUT: updates admin settings (admin-only)

**Expected Outcomes:**
- [x] Admin can toggle between Stripe and Dodo from the admin page
- [x] New checkouts use the selected provider
- [x] Non-admin users cannot access the admin page

---

## Sprint 2 — Verification Checklist

- [x] Payment provider factory returns correct provider based on admin setting
- [x] Stripe checkout session creates successfully (test mode)
- [x] Dodo checkout session creates successfully (sandbox)
- [x] Webhook endpoints accept and verify events from both providers
- [x] Successful payment creates a subscription record in DB
- [x] `/pricing` page renders plans from the database
- [x] Billing settings page shows current subscription status
- [x] Admin can toggle payment provider
- [x] `turbo build` passes
- [x] `turbo test` passes (unit tests for provider abstraction)
