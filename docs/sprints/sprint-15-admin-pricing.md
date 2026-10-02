# Sprint 15: Admin Pricing & Plan Management

**Phase**: Phase 2
**Estimated effort**: 3–4 days
**Dependencies**: Sprint 2 (payments foundation), Sprint 14 (team & agency)
**Status**: Implemented (migration 0014, `/admin` tabs, `/api/admin/plans`, DB-backed limits, dynamic pricing). Verified by unit/route tests, `tsc`, lint and build; click-through of the live admin UI and a real checkout still needs a running database and payment provider test keys.
**Goal**: Provide a dedicated Admin Management Suite where system administrators can strictly configure, update, and manage subscription pricing, billing intervals, feature limits, and tier allowances directly in the database without code changes.

---

## Tasks

### Task 15.1 — Database Schema for Dynamic Plan Limits & Features

- [x] Extend `plans` table (or add `planLimits` jsonb column):
  - `limits`: jsonb storing `{ maxSpaces: number, maxTestimonialsPerSpace: number, removeWatermark: boolean, canCustomizeBranding: boolean, canUseAllTriggers: boolean, canAccessAnalytics: boolean, canUseCustomRules: boolean }`
  - `sortOrder`: integer default 0
  - `badge`: text nullable (e.g. "Most Popular", "Best Value")
  - `isCustom`: boolean default false
- [x] Run migration

**Expected Outcomes:**
- [x] Plan limits and feature entitlements are stored directly in the database per plan
- [x] Pricing and intervals are configurable without hardcoded constants

---

### Task 15.2 — Admin Plan Management API

- [x] Create `apps/dashboard/app/api/admin/plans/route.ts`:
  - `GET`: List all plans (active and inactive) with subscriber counts and limits
  - `POST`: Create a new subscription plan with name, price in cents, interval, feature list, plan limits, and provider price IDs
- [x] Create `apps/dashboard/app/api/admin/plans/[id]/route.ts`:
  - `GET`: Get plan details
  - `PATCH`: Update plan price, name, features, limits, provider product/price IDs, active status
  - `DELETE`: Deactivate / archive plan (prevent new checkouts while preserving existing subscribers)
- [x] Admin authentication check (`role === "owner" || role === "admin"`)

**Expected Outcomes:**
- [x] Admins can create, edit, deactivate, and view plans via REST API
- [x] Unauthorized users receive 403 Forbidden
- [x] Validation prevents invalid prices, intervals, or malformed feature limits

---

### Task 15.3 — Admin Pricing & Plans Management UI

- [x] Add "Plans & Pricing" tab/section to `apps/dashboard/app/(dashboard)/admin/page.tsx`
- [x] Plans list table displaying:
  - Plan name, price ($/mo or $/yr), interval, active subscriber count, status (Active/Archived)
  - Edit button, Archive/Activate toggle
- [x] Create/Edit Plan modal/form:
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
- [x] Admins can adjust prices and entitlements directly from `/admin`
- [x] Changes save immediately to the database

---

### Task 15.4 — Dynamic Subscription Limits Integration

- [x] Refactor `apps/dashboard/lib/payments/subscription.ts`:
  - Replace hardcoded `PLAN_LIMITS` with database query pulling limits directly from the user's active `plan` record
  - Provide fallback defaults for Free tier if no plan is assigned
- [x] Update feature gating checks across the dashboard (spaces, testimonials, widget branding, watermark removal) to use the database-backed limits

**Expected Outcomes:**
- [x] Changing a plan's limits in the admin area immediately updates feature permissions for all users on that plan
- [x] No hardcoded plan limit constants in application code

---

### Task 15.5 — Public Pricing & Checkout Dynamic Sync

- [x] Update `apps/dashboard/app/(marketing)/pricing/page.tsx` to display active plans directly from the database
- [x] Checkout session creation routes (`/api/checkout`) dynamically resolve price, interval, and provider IDs from the database plan
- [x] Ensure currency formatting and interval switching (monthly vs yearly) remain responsive

**Expected Outcomes:**
- [x] Public `/pricing` page renders current prices and features set in Admin
- [x] Checkout charges the exact price configured in the Admin area

---

## Sprint 15 — Verification Checklist

- [x] Admin can create a new plan from `/admin`
- [x] Admin can update existing plan prices and feature limits from `/admin`
- [x] Gating checks (`removeWatermark`, `maxSpaces`, etc.) dynamically read limits from the database
- [x] Public `/pricing` page displays admin-configured prices
- [x] Checkout sessions charge the updated admin price
- [x] Non-admin users cannot access admin pricing endpoints
- [x] `turbo build` passes
- [x] `turbo test` passes
