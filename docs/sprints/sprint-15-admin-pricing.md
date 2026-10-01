# Sprint 15: Admin Pricing & Plan Management

**Phase**: Phase 2
**Estimated effort**: 3–4 days
**Dependencies**: Sprint 2 (payments foundation), Sprint 14 (team & agency)
**Goal**: Provide a dedicated Admin Management Suite where system administrators can strictly configure, update, and manage subscription pricing, billing intervals, feature limits, and tier allowances directly in the database without code changes.

---

## Tasks

### Task 15.1 — Database Schema for Dynamic Plan Limits & Features

- [ ] Extend `plans` table (or add `planLimits` jsonb column):
  - `limits`: jsonb storing `{ maxSpaces: number, maxTestimonialsPerSpace: number, removeWatermark: boolean, canCustomizeBranding: boolean, canUseAllTriggers: boolean, canAccessAnalytics: boolean, canUseCustomRules: boolean }`
  - `sortOrder`: integer default 0
  - `badge`: text nullable (e.g. "Most Popular", "Best Value")
  - `isCustom`: boolean default false
- [ ] Run migration

**Expected Outcomes:**
- [ ] Plan limits and feature entitlements are stored directly in the database per plan
- [ ] Pricing and intervals are configurable without hardcoded constants

---

### Task 15.2 — Admin Plan Management API

- [ ] Create `apps/dashboard/app/api/admin/plans/route.ts`:
  - `GET`: List all plans (active and inactive) with subscriber counts and limits
  - `POST`: Create a new subscription plan with name, price in cents, interval, feature list, plan limits, and provider price IDs
- [ ] Create `apps/dashboard/app/api/admin/plans/[id]/route.ts`:
  - `GET`: Get plan details
  - `PATCH`: Update plan price, name, features, limits, provider product/price IDs, active status
  - `DELETE`: Deactivate / archive plan (prevent new checkouts while preserving existing subscribers)
- [ ] Admin authentication check (`role === "owner" || role === "admin"`)

**Expected Outcomes:**
- [ ] Admins can create, edit, deactivate, and view plans via REST API
- [ ] Unauthorized users receive 403 Forbidden
- [ ] Validation prevents invalid prices, intervals, or malformed feature limits

---

### Task 15.3 — Admin Pricing & Plans Management UI

- [ ] Add "Plans & Pricing" tab/section to `apps/dashboard/app/(dashboard)/admin/page.tsx`
- [ ] Plans list table displaying:
  - Plan name, price ($/mo or $/yr), interval, active subscriber count, status (Active/Archived)
  - Edit button, Archive/Activate toggle
- [ ] Create/Edit Plan modal/form:
  - Plan name, description, badge
  - Price (formatted in dollars, stored in cents) and interval (monthly/yearly)
  - Stripe Product ID, Stripe Price ID, Dodo Product ID, Dodo Price ID
  - Feature limits toggles:
    - Maximum spaces allowed
    - Maximum testimonials per space
    - Watermark removal entitlement (`removeWatermark`)
    - Custom branding entitlement (`canCustomizeBranding`)
    - Analytics access entitlement (`canAccessAnalytics`)
    - Custom CSS and advanced match rules
  - Feature list bullet points for marketing display

**Expected Outcomes:**
- [ ] Admins can adjust prices and entitlements directly from `/admin`
- [ ] Changes save immediately to the database

---

### Task 15.4 — Dynamic Subscription Limits Integration

- [ ] Refactor `apps/dashboard/lib/payments/subscription.ts`:
  - Replace hardcoded `PLAN_LIMITS` with database query pulling limits directly from the user's active `plan` record
  - Provide fallback defaults for Free tier if no plan is assigned
- [ ] Update feature gating checks across the dashboard (spaces, testimonials, widget branding, watermark removal) to use the database-backed limits

**Expected Outcomes:**
- [ ] Changing a plan's limits in the admin area immediately updates feature permissions for all users on that plan
- [ ] No hardcoded plan limit constants in application code

---

### Task 15.5 — Public Pricing & Checkout Dynamic Sync

- [ ] Update `apps/dashboard/app/(marketing)/pricing/page.tsx` to display active plans directly from the database
- [ ] Checkout session creation routes (`/api/checkout`) dynamically resolve price, interval, and provider IDs from the database plan
- [ ] Ensure currency formatting and interval switching (monthly vs yearly) remain responsive

**Expected Outcomes:**
- [ ] Public `/pricing` page renders current prices and features set in Admin
- [ ] Checkout charges the exact price configured in the Admin area

---

## Sprint 15 — Verification Checklist

- [ ] Admin can create a new plan from `/admin`
- [ ] Admin can update existing plan prices and feature limits from `/admin`
- [ ] Gating checks (`removeWatermark`, `maxSpaces`, etc.) dynamically read limits from the database
- [ ] Public `/pricing` page displays admin-configured prices
- [ ] Checkout sessions charge the updated admin price
- [ ] Non-admin users cannot access admin pricing endpoints
- [ ] `turbo build` passes
- [ ] `turbo test` passes
