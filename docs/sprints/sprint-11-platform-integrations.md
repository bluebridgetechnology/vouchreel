# Sprint 11: Platform Integrations

**Phase**: Phase 2
**Estimated effort**: 7–10 days
**Dependencies**: MVP complete (widget, analytics, CRUD)
**Goal**: Build native integrations for Shopify, WordPress, and Webflow to lower friction vs. a raw script tag. Add Zapier/Make integration and a public API with webhooks. After this sprint, owners on major platforms can install Vouchreel natively, and developers can build on top of the API.

---

## Tasks

### Task 11.1 — Shopify Integration

- [x] Streamlined Shopify theme integration (Liquid snippet generator in dashboard)
- [x] Product-level testimonial matching (via `product.id` / `product.handle` tag mapping)
- [x] App Embed Block / theme.liquid insertion documentation
- [x] Comprehensive Shopify integration guide (`docs/integrations/shopify.md`)
- [x] Documented App Store submission requirements for future custom apps

**Expected Outcomes:**
- [x] Shopify store owner can copy optimized Liquid snippet from dashboard with their embed key
- [x] Widget script auto-runs and targets product pages
- [x] Product-level matching works with Shopify product IDs & handles
- [x] Step-by-step documentation for vintage themes and Shopify 2.0 (Dawn)

---

### Task 11.2 — WordPress Plugin

- [x] Create WordPress plugin structure (`integrations/wordpress/vouchreel/` plugin directory)
- [x] Admin settings page: embed key input, auto-inject toggle, API URL setting
- [x] Auto-inject widget script into `wp_footer`
- [x] Gutenberg block (`vouchreel/widget`) and `[vouchreel]` shortcode for inline widget placement
- [x] Document WordPress.org submission process and standard `readme.txt`

**Expected Outcomes:**
- [x] WordPress admin can enter embed key and widget auto-loads on the site
- [x] Gutenberg block allows per-page widget placement
- [x] Plugin follows WordPress coding standards (sanitized inputs, escaped outputs)

---

### Task 11.3 — Webflow / Framer Components

- [x] Create Webflow custom embed component and CMS collection documentation (`docs/integrations/webflow.md`)
- [x] Create Framer component React code and custom code documentation (`docs/integrations/framer.md`)
- [x] Provide copy-paste snippets optimized for each platform in dashboard embed drawer
- [x] Updated main widget integration documentation (`docs/widget-integration.md`)

**Expected Outcomes:**
- [x] Webflow users can add the widget via custom embed or CMS template
- [x] Framer users can add the widget via code component or custom body code
- [x] Integration guides are clear and tested

---

### Task 11.4 — Zapier / Make Integration

- [x] Webhook triggers:
  - `testimonial.created`, `submission.received`, `submission.approved`, `conversion.tracked`
- [x] REST API actions:
  - List collection forms / get collection URL (`GET /api/v1/collection-forms`)
  - Create testimonial from external data (`POST /api/v1/testimonials`)
- [x] Document Make (Integromat) webhook module & HTTP scenario integration (`docs/integrations/make.md`)
- [x] Document Zapier workflows: "Deal closed in CRM → send testimonial request" (`docs/integrations/zapier.md`)

**Expected Outcomes:**
- [x] Zapier triggers fire on new testimonials and submissions
- [x] Zapier actions can create collection links and submit testimonials
- [x] Make integration works via webhooks and HTTP module

---

### Task 11.5 — Public REST API

- [x] Create versioned API routes: `/api/v1/spaces`, `/api/v1/testimonials`, `/api/v1/analytics`, `/api/v1/collection-forms`
- [x] API key authentication (`Authorization: Bearer vr_live_...` generated per space in dashboard)
- [x] Endpoints:
  - Spaces: list (`/api/v1/spaces`), get (`/api/v1/spaces/[id]`)
  - Testimonials: list (`GET`), get (`GET [id]`), create (`POST`), update (`PUT [id]`), delete (`DELETE [id]`)
  - Analytics: overview (`/api/v1/analytics/overview`), per-testimonial (`/api/v1/analytics/testimonials`)
  - Collection forms: list (`/api/v1/collection-forms`), get (`/api/v1/collection-forms/[id]`), get submissions (`/api/v1/collection-forms/[id]/submissions`)
- [x] Rate limiting per API key (with `X-RateLimit-*` and `Retry-After` headers)
- [x] API documentation page (`docs/api-reference.md`)

**Expected Outcomes:**
- [x] API keys can be generated and managed in the dashboard (`/settings/api-keys`)
- [x] All CRUD operations work via API with isolated space scoping
- [x] Rate limiting prevents abuse
- [x] API documentation is available

---

### Task 11.6 — Webhooks

- [x] Webhook configuration UI in dashboard (`/settings/webhooks`): add endpoint URL, select events
- [x] Webhook events:
  - `testimonial.created`, `testimonial.updated`, `testimonial.deleted`
  - `submission.received`, `submission.approved`
  - `conversion.tracked`
- [x] Webhook delivery: POST to configured URL with payload + HMAC-SHA256 signature (`X-Vouchreel-Signature`)
- [x] Retry logic for failed deliveries (3 retries with exponential backoff via `/api/cron/process-webhooks`)
- [x] Webhook delivery log in dashboard (expandable inspector showing timestamp, attempts, status, HTTP code)

**Expected Outcomes:**
- [x] Owner can configure webhook endpoints and copy signing secrets
- [x] Events fire correctly and deliver payloads
- [x] Signatures allow receivers to verify authenticity
- [x] Failed deliveries are retried via cron
- [x] Delivery log shows status of each webhook call

---

## Sprint 11 — Verification Checklist

- [x] Shopify integration generates product-matching Liquid snippet
- [x] WordPress plugin injects widget and Gutenberg block / shortcode work
- [x] Webflow/Framer integration guides are tested
- [x] Zapier triggers and actions documented and verified
- [x] Public API CRUD operations work with API key auth
- [x] API rate limiting is enforced
- [x] Webhooks deliver events to configured endpoints with HMAC-SHA256
- [x] Webhook retry logic works for failed deliveries
- [x] `turbo build` passes
- [x] `turbo test` passes (193 tests passing)
