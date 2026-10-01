# Sprint 6: Analytics & Attribution

**Phase**: MVP (Phase 1)
**Estimated effort**: 3–4 days
**Dependencies**: Sprint 5 (widget sends events)
**Goal**: Build the analytics dashboard showing impressions, plays, clicks, and conversions. Implement conversion goal setup and the attribution funnel. After this sprint, space owners can see how their testimonials perform and measure ROI.

---

## Status — implemented & runtime-verified 2026-09-29

- 6.1–6.5 code complete: `lib/analytics/queries.ts`, index migration `0002_tiny_dreaming_celestial.sql`, `/api/spaces/[id]/analytics`, `/api/spaces/[id]/conversion-goals`, analytics dashboard (overview cards w/ trends, Recharts time series, CSS funnel, sortable per-testimonial table, skeletons, empty state), conversion goals UI with copyable pixel snippet, `window.vouchreelConvert` wired in widget loader (bundle rebuilt, 8.9KB gz).
- 6.6: seed script `apps/dashboard/scripts/seed-events.mjs` + `db:seed` script created; 7 new validation tests added. `turbo build` and `turbo test` (154 tests) pass.
- Runtime verification (local Docker Postgres): migration applied (both `events` indexes present); seed inserted 2,887 events (1,892 impressions / 698 plays / 256 clicks / 41 conversions) over 35 days; all 4 analytics API types return correct data; goal CRUD works (create pixel + url-match, validation rejections, delete); access control verified (401 unauthenticated, 403 other-owner, 404 unknown space); analytics page rendered in browser — cards with trends & play/conversion rates, chart, funnel with drop-off %, sortable table, goals panel; 7d/30d range switching verified; pixel goal created via UI with snippet display; no console errors.

---

## Tasks

### Task 6.1 — Analytics Data Layer

- [ ] Create `apps/dashboard/lib/analytics/queries.ts` — analytics query functions using Drizzle:
  - `getOverviewStats(spaceId, dateRange)` → total impressions, plays, clicks, conversions
  - `getPerTestimonialStats(spaceId, dateRange)` → breakdown per testimonial
  - `getTimeSeries(spaceId, dateRange, interval)` → daily/weekly aggregated counts
  - `getConversionFunnel(spaceId, dateRange)` → impression → play → click → convert counts
- [ ] Add database indexes for performance:
  - `events(space_id, event_type, timestamp)`
  - `events(space_id, testimonial_id, event_type)`
- [ ] Create migration for the new indexes

**Expected Outcomes:**
- [ ] Overview stats query returns correct aggregated counts
- [ ] Per-testimonial breakdown returns stats for each testimonial
- [ ] Time-series query returns data grouped by day
- [ ] Conversion funnel returns step-by-step counts
- [ ] Queries perform well with indexes (tested with seed data)

---

### Task 6.2 — Analytics API Routes

- [ ] Create `apps/dashboard/app/api/spaces/[id]/analytics/route.ts`
  - GET: accepts query params `startDate`, `endDate`, `type` (overview|testimonials|timeseries|funnel)
  - Returns the requested analytics data
  - Ownership verification
- [ ] Add Zod validation for date range params
- [ ] Default date range: last 30 days

**Expected Outcomes:**
- [ ] `GET /api/spaces/{id}/analytics?type=overview` returns total stats
- [ ] `GET /api/spaces/{id}/analytics?type=testimonials` returns per-testimonial stats
- [ ] `GET /api/spaces/{id}/analytics?type=timeseries` returns daily data points
- [ ] `GET /api/spaces/{id}/analytics?type=funnel` returns funnel data
- [ ] Date range filtering works correctly
- [ ] Non-owners get 403

---

### Task 6.3 — Analytics Dashboard UI

- [ ] Create `apps/dashboard/app/(dashboard)/spaces/[id]/analytics/page.tsx`
- [ ] **Overview cards** (top section):
  - Total impressions (with trend vs. previous period)
  - Total plays (with play rate %)
  - Total clicks
  - Total conversions (with conversion rate %)
  - Use shadcn/ui Card components
- [ ] **Time-series chart** (middle section):
  - Line chart showing impressions + plays over time
  - Date range selector (7d, 30d, 90d, custom)
  - Use a lightweight chart library (Recharts or Chart.js)
- [ ] **Per-testimonial table** (bottom section):
  - Table with columns: Testimonial (thumbnail + title), Impressions, Plays, Play Rate, Clicks, Conversions
  - Sortable columns
  - Pagination if many testimonials
- [ ] Loading skeletons for all sections
- [ ] Empty state when no data exists yet

**Expected Outcomes:**
- [ ] Analytics page shows overview cards with correct numbers
- [ ] Time-series chart renders daily data with selectable ranges
- [ ] Per-testimonial table shows breakdowns per testimonial
- [ ] All data matches what's in the events table
- [ ] Empty state is shown when there are no events
- [ ] Loading states display skeletons

---

### Task 6.4 — Conversion Goal Setup

- [ ] Create `apps/dashboard/app/api/spaces/[id]/conversion-goals/route.ts`
  - GET: list goals for a space
  - POST: create a new goal
  - DELETE: remove a goal
- [ ] Create conversion goal setup UI within the analytics page (or a sub-section):
  - **URL match goal**: input for goal URL (e.g., `/thank-you`, `/order-confirmation`)
  - **Conversion pixel**: generate a small `<script>` snippet that fires a convert event
    ```html
    <script>
      window.vouchreelConvert && window.vouchreelConvert('goal-id');
    </script>
    ```
  - List existing goals with delete option
- [ ] Explanation text: "Track whether visitors who see your testimonials end up converting"

**Expected Outcomes:**
- [ ] User can create a URL-match conversion goal
- [ ] User can create a pixel-based conversion goal and copy the snippet
- [ ] Goals are listed with delete option
- [ ] Widget (from Sprint 5) checks goal URLs and fires convert events
- [ ] Conversions appear in the analytics dashboard

---

### Task 6.5 — Conversion Funnel Visualization

- [ ] Add a funnel chart or stepped visualization to the analytics page:
  - Impressions → Plays → Clicks → Conversions
  - Show absolute numbers and % drop-off at each step
  - Highlight the play-through rate and conversion rate
- [ ] Use a simple funnel visualization (CSS bars or a chart library)

**Expected Outcomes:**
- [ ] Funnel shows 4 steps with correct numbers
- [ ] Drop-off percentages are calculated and displayed
- [ ] Funnel is visually clear and easy to understand

---

### Task 6.6 — Seed Data & Testing

- [ ] Create a seed script that generates realistic test events:
  - Multiple testimonials with varying impressions/plays/clicks
  - Events spread over 30+ days
  - Some conversion events
- [ ] Add `db:seed` script to package.json
- [ ] Use seed data to verify all analytics views work correctly

**Expected Outcomes:**
- [ ] `npm run db:seed` populates events table with test data
- [ ] Analytics dashboard renders correctly with seed data
- [ ] All charts and tables display meaningful information
- [ ] Funnel visualization works with test conversions

---

## Sprint 6 — Verification Checklist

- [ ] Analytics page loads with overview cards showing correct stats
- [ ] Time-series chart displays daily data with date range selection
- [ ] Per-testimonial table shows correct metrics per testimonial
- [ ] Conversion goal can be created (URL match + pixel types)
- [ ] Conversion pixel snippet is copiable
- [ ] Funnel visualization shows impression → play → click → convert flow
- [ ] Analytics data correctly reflects events from the widget
- [ ] Empty state is shown when no events exist
- [ ] Database indexes improve query performance
- [ ] `turbo build` passes
- [ ] `turbo test` passes
