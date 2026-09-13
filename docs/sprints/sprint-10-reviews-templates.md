# Sprint 10: Reviews Import + Curated Templates

**Phase**: Phase 2
**Estimated effort**: 5–7 days
**Dependencies**: Sprint 8 (collection pipeline), MVP widget (Sprint 5)
**Goal**: Import text reviews from Google and Trustpilot via official APIs, and build 3–5 curated display templates that blend text reviews with video testimonials. After this sprint, owners can connect their Google/Trustpilot accounts and display a rich "wall of love" mixing video and text.

---

## Tasks

### Task 10.1 — Reviews Database Schema

- [ ] Add `reviewSources` table: `id`, `spaceId` FK, `provider` (enum: google/trustpilot), `providerBusinessId`, `credentials` (encrypted jsonb), `lastSyncAt`, `isActive`, `createdAt`
- [ ] Add `reviews` table: `id`, `spaceId` FK, `sourceId` FK, `provider`, `authorName`, `rating`, `text`, `reviewDate`, `providerReviewId` (unique), `isApproved`, `createdAt`
- [ ] Run migration

**Expected Outcomes:**
- [ ] Tables exist with correct schema and relationships

---

### Task 10.2 — Google Reviews Integration

- [ ] Implement Google Places API / Business Profile API integration
- [ ] OAuth flow or API key setup for connecting a Google Business
- [ ] Fetch reviews (official API caps at ~5 most recent reviews)
- [ ] Store reviews in the `reviews` table
- [ ] Scheduled sync job (cron or background task) respecting rate limits
- [ ] Caching strategy to minimize API calls

**Expected Outcomes:**
- [ ] Owner can connect their Google Business listing
- [ ] Reviews are fetched and stored
- [ ] Sync runs periodically without exceeding rate limits
- [ ] API limitations (5 review cap) are clearly communicated to the user

---

### Task 10.3 — Trustpilot Reviews Integration

- [ ] Implement Trustpilot Business API integration
- [ ] API key setup for connecting Trustpilot business
- [ ] Fetch reviews with pagination
- [ ] Store in `reviews` table
- [ ] Scheduled sync respecting rate limits

**Expected Outcomes:**
- [ ] Owner can connect their Trustpilot business
- [ ] Reviews are fetched and stored
- [ ] Sync runs periodically

---

### Task 10.4 — Reviews Management UI

- [ ] Create `apps/dashboard/app/(dashboard)/spaces/[id]/reviews/page.tsx`
  - List imported reviews with source badge (Google/Trustpilot)
  - Approve/hide individual reviews
  - Show sync status and last sync time
  - "Connect" buttons for each provider
  - Manual refresh button

**Expected Outcomes:**
- [ ] Reviews are listed with source indicators
- [ ] Owner can approve/hide reviews
- [ ] Sync status is visible

---

### Task 10.5 — Curated Display Templates

- [ ] Build 3–5 distinct widget/embed templates:
  1. **Wall of Love** — masonry grid mixing video thumbnails and text review cards
  2. **Carousel / Slider** — horizontal scrolling testimonials (video + text)
  3. **Story Strip** — Instagram-style circles at top/bottom of page
  4. **Minimal Floating Card** — evolved version of the MVP widget
  5. **Masonry Grid** — Pinterest-style layout
- [ ] Template selection UI in widget settings
- [ ] Each template uses the contextual matching engine from MVP
- [ ] Templates blend video testimonials + text reviews in a unified display
- [ ] Responsive across all templates

**Expected Outcomes:**
- [ ] 3–5 templates are available in widget settings
- [ ] Each template renders both video and text testimonials
- [ ] Templates are visually distinct and polished
- [ ] Contextual matching applies within each template

---

## Sprint 10 — Verification Checklist

- [ ] Google reviews import works via official API
- [ ] Trustpilot reviews import works via official API
- [ ] Reviews appear in dashboard with source badges
- [ ] Owner can approve/hide reviews
- [ ] Sync runs on schedule without rate limit errors
- [ ] All 3–5 templates render correctly
- [ ] Templates blend video + text testimonials
- [ ] Contextual matching works within templates
- [ ] Templates are responsive on mobile
- [ ] `turbo build` passes
- [ ] `turbo test` passes
