# Sprint 10: Reviews Import + Curated Templates

**Phase**: Phase 2
**Estimated effort**: 5–7 days
**Dependencies**: Sprint 8 (collection pipeline), MVP widget (Sprint 5)
**Goal**: Import text reviews from Google and Trustpilot via official APIs, and build 3–5 curated display templates that blend text reviews with video testimonials. After this sprint, owners can connect their Google/Trustpilot accounts and display a rich "wall of love" mixing video and text.

---

## Tasks

### Task 10.1 — Reviews Database Schema

- [x] Add `reviewSources` table: `id`, `spaceId` FK, `provider` (enum: google/trustpilot), `providerBusinessId`, `credentials` (encrypted jsonb), `lastSyncAt`, `isActive`, `createdAt`
- [x] Add `reviews` table: `id`, `spaceId` FK, `sourceId` FK, `provider`, `authorName`, `rating`, `text`, `reviewDate`, `providerReviewId` (unique), `isApproved`, `createdAt`
- [x] Run migration

**Expected Outcomes:**
- [x] Tables exist with correct schema and relationships

---

### Task 10.2 — Google Reviews Integration

- [x] Implement Google Places API / Business Profile API integration
- [x] OAuth flow or API key setup for connecting a Google Business
- [x] Fetch reviews (official API caps at ~5 most recent reviews)
- [x] Store reviews in the `reviews` table
- [x] Scheduled sync job (cron or background task) respecting rate limits
- [x] Caching strategy to minimize API calls

**Expected Outcomes:**
- [x] Owner can connect their Google Business listing
- [x] Reviews are fetched and stored
- [x] Sync runs periodically without exceeding rate limits
- [x] API limitations (5 review cap) are clearly communicated to the user

---

### Task 10.3 — Trustpilot Reviews Integration

- [x] Implement Trustpilot Business API integration
- [x] API key setup for connecting Trustpilot business
- [x] Fetch reviews with pagination
- [x] Store in `reviews` table
- [x] Scheduled sync respecting rate limits

**Expected Outcomes:**
- [x] Owner can connect their Trustpilot business
- [x] Reviews are fetched and stored
- [x] Sync runs periodically

---

### Task 10.4 — Reviews Management UI

- [x] Create `apps/dashboard/app/(dashboard)/spaces/[id]/reviews/page.tsx`
  - List imported reviews with source badge (Google/Trustpilot)
  - Approve/hide individual reviews
  - Show sync status and last sync time
  - "Connect" buttons for each provider
  - Manual refresh button

**Expected Outcomes:**
- [x] Reviews are listed with source indicators
- [x] Owner can approve/hide reviews
- [x] Sync status is visible

---

### Task 10.5 — Curated Display Templates

- [x] Build 3–5 distinct widget/embed templates:
  1. **Wall of Love** — masonry grid mixing video thumbnails and text review cards
  2. **Carousel / Slider** — horizontal scrolling testimonials (video + text)
  3. **Story Strip** — Instagram-style circles at top/bottom of page
  4. **Minimal Floating Card** — evolved version of the MVP widget
  5. **Masonry Grid** — Pinterest-style layout
- [x] Template selection UI in widget settings
- [x] Each template uses the contextual matching engine from MVP
- [x] Templates blend video testimonials + text reviews in a unified display
- [x] Responsive across all templates

**Expected Outcomes:**
- [x] 3–5 templates are available in widget settings
- [x] Each template renders both video and text testimonials
- [x] Templates are visually distinct and polished
- [x] Contextual matching applies within each template

---

## Sprint 10 — Verification Checklist

- [x] Google reviews import works via official API
- [x] Trustpilot reviews import works via official API
- [x] Reviews appear in dashboard with source badges
- [x] Owner can approve/hide reviews
- [x] Sync runs on schedule without rate limit errors
- [x] All 3–5 templates render correctly
- [x] Templates blend video + text testimonials
- [x] Contextual matching works within templates
- [x] Templates are responsive on mobile
- [x] `turbo build` passes
- [x] `turbo test` passes
