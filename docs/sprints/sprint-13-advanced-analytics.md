# Sprint 13: Advanced Analytics & A/B Testing

**Phase**: Phase 2
**Estimated effort**: 5–7 days
**Dependencies**: Sprint 6 (basic analytics), Sprint 10 (templates)
**Goal**: Add A/B testing for widget variations, full funnel analytics segmented by testimonial and page, multi-language caption support, and exportable reports. After this sprint, owners and agencies can run experiments and generate ROI reports for their clients.

---

## Tasks

### Task 13.1 — A/B Testing Engine

- [ ] Add `experiments` table: `id`, `spaceId` FK, `name`, `type` (enum: trigger/position/template), `variants` (jsonb array), `trafficSplit` (jsonb), `status` (enum: draft/running/completed), `startedAt`, `endedAt`, `createdAt`
- [ ] Add `experimentAssignments` table: `id`, `experimentId` FK, `sessionId`, `variantIndex`, `createdAt`
- [ ] Widget: on load, check for active experiments → assign variant → use variant config
- [ ] Deterministic assignment: hash(sessionId + experimentId) → consistent variant
- [ ] Run migration

**Expected Outcomes:**
- [ ] Experiments can be created with multiple variants
- [ ] Widget assigns visitors to variants deterministically
- [ ] Assignment is consistent across page loads in the same session

---

### Task 13.2 — A/B Testing UI

- [ ] Create `apps/dashboard/app/(dashboard)/spaces/[id]/experiments/page.tsx`
  - Create experiment: name, type (trigger / position / template), variants with config
  - Set traffic split (e.g., 50/50, 70/30)
  - Start / pause / end experiment
  - Results view: per-variant metrics (impressions, plays, clicks, conversions)
  - Statistical significance indicator (simple z-test or chi-square)
  - "Apply winner" button → update widget config with winning variant

**Expected Outcomes:**
- [ ] Owner can create and manage experiments
- [ ] Results show per-variant performance
- [ ] Statistical significance is indicated
- [ ] Winning variant can be applied with one click

---

### Task 13.3 — Enhanced Funnel Analytics

- [ ] Upgrade analytics to support segmentation:
  - By testimonial
  - By page URL
  - By device type (mobile/desktop)
  - By traffic source (referrer)
  - By experiment variant
- [ ] Full funnel visualization with filters
- [ ] Comparison view: compare two time periods or two segments

**Expected Outcomes:**
- [ ] Funnel can be filtered by testimonial, page, device, etc.
- [ ] Comparison view shows side-by-side metrics
- [ ] Segmented data is accurate

---

### Task 13.4 — Exportable Reports

- [ ] PDF report generation:
  - Summary stats, funnel, top testimonials, conversion data
  - Branded header (space name + date range)
  - Charts rendered as images for the PDF
- [ ] CSV export of raw analytics data
- [ ] "Generate report" button in analytics dashboard
- [ ] Agencies can white-label reports (their logo instead of Vouchreel's)

**Expected Outcomes:**
- [ ] PDF report generates with correct data and charts
- [ ] CSV export contains all raw events
- [ ] Reports are downloadable from the dashboard
- [ ] Agency white-label works on reports

---

### Task 13.5 — Multi-Language Captions

- [ ] Detect visitor locale via `navigator.language` or page `lang` attribute
- [ ] If transcript exists and locale differs from video language:
  - Auto-translate via Google Translate API or DeepL
  - Cache translations in storage
- [ ] Widget: render captions in visitor's language
- [ ] Dashboard: show available translations per testimonial

**Expected Outcomes:**
- [ ] Captions auto-translate to visitor's language
- [ ] Translations are cached for performance
- [ ] Dashboard shows which translations exist
- [ ] Original language is always available as fallback

---

## Sprint 13 — Verification Checklist

- [ ] Experiments can be created with multiple variants
- [ ] Widget correctly assigns visitors to experiment variants
- [ ] Per-variant metrics are tracked and displayed
- [ ] Statistical significance calculation works
- [ ] "Apply winner" updates widget config
- [ ] Funnel analytics support segmentation filters
- [ ] PDF reports generate with correct data
- [ ] CSV export works
- [ ] Multi-language captions translate correctly
- [ ] `turbo build` passes
- [ ] `turbo test` passes
