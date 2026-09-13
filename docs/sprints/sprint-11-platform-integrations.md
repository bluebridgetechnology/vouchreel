# Sprint 11: Platform Integrations

**Phase**: Phase 2
**Estimated effort**: 7–10 days
**Dependencies**: MVP complete (widget, analytics, CRUD)
**Goal**: Build native integrations for Shopify, WordPress, and Webflow to lower friction vs. a raw script tag. Add Zapier/Make integration and a public API with webhooks. After this sprint, owners on major platforms can install Vouchreel natively, and developers can build on top of the API.

---

## Tasks

### Task 11.1 — Shopify App

- [ ] Create Shopify app structure (can be a sub-project or separate deploy)
- [ ] Implement Shopify OAuth install flow
- [ ] App settings page: connect to Vouchreel space, select embed key
- [ ] Auto-inject widget script into the Shopify storefront (via ScriptTag API or App Embed Block)
- [ ] Product-level testimonial matching: sync Shopify product IDs to testimonial tags
- [ ] Submit to Shopify App Store (or document the submission process)

**Expected Outcomes:**
- [ ] Shopify store owner can install the app and connect their Vouchreel space
- [ ] Widget script is automatically injected into the storefront
- [ ] Product-level matching works with Shopify product IDs
- [ ] No manual `<script>` tag needed

---

### Task 11.2 — WordPress Plugin

- [ ] Create WordPress plugin structure (`vouchreel/` plugin directory)
- [ ] Admin settings page: embed key input, position/trigger overrides
- [ ] Auto-inject widget script into `wp_footer`
- [ ] Gutenberg block for inline widget placement on specific pages
- [ ] Document WordPress.org submission process

**Expected Outcomes:**
- [ ] WordPress admin can enter embed key and widget auto-loads on the site
- [ ] Gutenberg block allows per-page widget placement
- [ ] Plugin follows WordPress coding standards

---

### Task 11.3 — Webflow / Framer Components

- [ ] Create Webflow custom embed component documentation
- [ ] Create Framer component or code override documentation
- [ ] Provide copy-paste snippets optimized for each platform
- [ ] Test on real Webflow and Framer sites

**Expected Outcomes:**
- [ ] Webflow users can add the widget via custom embed
- [ ] Framer users can add the widget via code component
- [ ] Integration guides are clear and tested

---

### Task 11.4 — Zapier / Make Integration

- [ ] Create Zapier app (or use Zapier's webhook/REST API integration pattern):
  - **Triggers**: new testimonial submitted, new review imported, conversion tracked
  - **Actions**: send testimonial request (create collection link), create testimonial from external data
- [ ] Create Make (Integromat) module or document webhook-based integration
- [ ] Test common workflows: "Deal closed in CRM → send testimonial request"

**Expected Outcomes:**
- [ ] Zapier triggers fire on new testimonials and submissions
- [ ] Zapier actions can create collection links
- [ ] Make integration works via webhooks

---

### Task 11.5 — Public REST API

- [ ] Create versioned API routes: `/api/v1/spaces`, `/api/v1/testimonials`, etc.
- [ ] API key authentication (generated per space in dashboard)
- [ ] Endpoints:
  - Spaces: list, get
  - Testimonials: list, get, create, update, delete
  - Analytics: get overview, get per-testimonial
  - Collection forms: list, get submissions
- [ ] Rate limiting per API key
- [ ] API documentation page (or OpenAPI spec)

**Expected Outcomes:**
- [ ] API keys can be generated in the dashboard
- [ ] All CRUD operations work via API
- [ ] Rate limiting prevents abuse
- [ ] API documentation is available

---

### Task 11.6 — Webhooks

- [ ] Webhook configuration UI in dashboard: add endpoint URL, select events
- [ ] Webhook events:
  - `testimonial.created`, `testimonial.updated`, `testimonial.deleted`
  - `submission.received`, `submission.approved`
  - `conversion.tracked`
- [ ] Webhook delivery: POST to configured URL with payload + signature
- [ ] Retry logic for failed deliveries (3 retries with exponential backoff)
- [ ] Webhook delivery log in dashboard

**Expected Outcomes:**
- [ ] Owner can configure webhook endpoints
- [ ] Events fire correctly and deliver payloads
- [ ] Signatures allow receivers to verify authenticity
- [ ] Failed deliveries are retried
- [ ] Delivery log shows status of each webhook call

---

## Sprint 11 — Verification Checklist

- [ ] Shopify app installs and auto-injects widget
- [ ] WordPress plugin injects widget and Gutenberg block works
- [ ] Webflow/Framer integration guides are tested
- [ ] Zapier triggers and actions work
- [ ] Public API CRUD operations work with API key auth
- [ ] API rate limiting is enforced
- [ ] Webhooks deliver events to configured endpoints
- [ ] Webhook retry logic works for failed deliveries
- [ ] `turbo build` passes
- [ ] `turbo test` passes
