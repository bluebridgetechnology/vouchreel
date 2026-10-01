# Sprint 13: Advanced Analytics & A/B Testing

**Phase**: Phase 2
**Estimated effort**: 5–7 days
**Dependencies**: Sprint 6 (basic analytics), Sprint 10 (templates)
**Goal**: Add A/B testing for widget variations, full funnel analytics segmented by testimonial and page, multi-language caption support, and exportable reports. After this sprint, owners and agencies can run experiments and generate ROI reports for their clients.

---

## Tasks

### Task 13.1 — A/B Testing Engine

- [x] Add `experiments` table: `id`, `spaceId` FK, `name`, `type` (enum: trigger/position/template), `variants` (jsonb array), `trafficSplit` (jsonb), `status` (enum: draft/running/completed), `startedAt`, `endedAt`, `createdAt`
- [x] Add `experimentAssignments` table: `id`, `experimentId` FK, `sessionId`, `variantIndex`, `createdAt`
- [x] Widget: on load, check for active experiments → assign variant → use variant config
- [x] Deterministic assignment: hash(sessionId + experimentId) → consistent variant
- [x] Run migration

**Expected Outcomes:**
- [x] Experiments can be created with multiple variants
- [x] Widget assigns visitors to variants deterministically
- [x] Assignment is consistent across page loads in the same session

---

### Task 13.2 — A/B Testing UI

- [x] Create `apps/dashboard/app/(dashboard)/spaces/[id]/experiments/page.tsx`
  - Create experiment: name, type (trigger / position / template), variants with config
  - Set traffic split (e.g., 50/50, 70/30)
  - Start / pause / end experiment
  - Results view: per-variant metrics (impressions, plays, clicks, conversions)
  - Statistical significance indicator (simple z-test or chi-square)
  - "Apply winner" button → update widget config with winning variant

**Expected Outcomes:**
- [x] Owner can create and manage experiments
- [x] Results show per-variant performance
- [x] Statistical significance is indicated
- [x] Winning variant can be applied with one click

---

### Task 13.3 — Enhanced Funnel Analytics

- [x] Upgrade analytics to support segmentation:
  - By testimonial
  - By page URL
  - By device type (mobile/desktop)
  - By traffic source (referrer)
  - By experiment variant
- [x] Full funnel visualization with filters
- [x] Comparison view: compare two time periods or two segments

**Expected Outcomes:**
- [x] Funnel can be filtered by testimonial, page, device, etc.
- [x] Comparison view shows side-by-side metrics
- [x] Segmented data is accurate

---

### Task 13.4 — Exportable Reports

- [x] PDF report generation:
  - Summary stats, funnel, top testimonials, conversion data
  - Branded header (space name + date range)
  - Charts rendered as images for the PDF
- [x] CSV export of raw analytics data
- [x] "Generate report" button in analytics dashboard
- [x] Agencies can white-label reports (their logo instead of Vouchreel's)

**Expected Outcomes:**
- [x] PDF report generates with correct data and charts
- [x] CSV export contains all raw events
- [x] Reports are downloadable from the dashboard
- [x] Agency white-label works on reports

---

### Task 13.5 — Multi-Language Captions

- [x] Detect visitor locale via `navigator.language` or page `lang` attribute
- [x] If transcript exists and locale differs from video language:
  - Auto-translate via Google Translate API or DeepL
  - Cache translations in storage
- [x] Widget: render captions in visitor's language
- [x] Dashboard: show available translations per testimonial

**Expected Outcomes:**
- [x] Captions auto-translate to visitor's language
- [x] Translations are cached for performance
- [x] Dashboard shows which translations exist
- [x] Original language is always available as fallback

---

## Sprint 13 — Verification Checklist

- [x] Experiments can be created with multiple variants
- [x] Widget correctly assigns visitors to experiment variants
- [x] Per-variant metrics are tracked and displayed
- [x] Statistical significance calculation works
- [x] "Apply winner" updates widget config
- [x] Funnel analytics support segmentation filters
- [x] PDF reports generate with correct data
- [x] CSV export works
- [x] Multi-language captions translate correctly
- [x] `turbo build` passes
- [x] `turbo test` passes
