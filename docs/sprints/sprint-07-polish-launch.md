# Sprint 7: Polish & Launch Prep

**Phase**: MVP (Phase 1)
**Estimated effort**: 3–4 days
**Dependencies**: Sprints 1–6 (all MVP features complete)
**Goal**: Final polish — accessibility audit, performance optimization, responsive testing, marketing/landing page, deployment pipeline (Docker + Vercel), and documentation. After this sprint, the MVP is production-ready and deployable.

---

## Tasks

### Task 7.1 — Accessibility Audit & Fixes

- [ ] Audit all dashboard pages with axe-core or Lighthouse accessibility checks
- [ ] Fix any a11y issues found:
  - Proper heading hierarchy
  - ARIA labels on all interactive elements
  - Keyboard navigation through all forms and modals
  - Focus management on modal open/close
  - Color contrast ratios (WCAG AA minimum)
- [ ] Widget-specific accessibility:
  - `aria-label` on the widget container, play button, close button
  - Keyboard-dismissible (Escape key) — verify from Sprint 5
  - Focus trap when widget is expanded
  - Screen reader announcements for widget appearance
  - `role="dialog"` on expanded widget
- [ ] Run Lighthouse accessibility audit — target score ≥ 90

**Expected Outcomes:**
- [ ] No critical a11y violations in Lighthouse or axe-core
- [ ] All interactive elements are keyboard-accessible
- [ ] Widget is fully screen-reader compatible
- [ ] Color contrast passes WCAG AA
- [ ] Lighthouse accessibility score ≥ 90

---

### Task 7.2 — Performance Optimization

- [ ] Dashboard performance:
  - Audit with Lighthouse Performance score
  - Optimize images (next/image with proper sizes)
  - Code-split heavy components (chart library, color picker)
  - Lazy-load below-fold sections
- [ ] Widget performance:
  - Verify bundle < 15 KB gzipped (from Sprint 5)
  - Verify zero CLS on host page (test with Lighthouse on test page)
  - Verify script doesn't block page render (async loading)
  - Measure time from script load to widget render
- [ ] API performance:
  - Verify widget data endpoint cache headers work
  - Test response times under load (basic stress test)
  - Verify event ingestion endpoint handles burst traffic

**Expected Outcomes:**
- [ ] Dashboard Lighthouse Performance score ≥ 80
- [ ] Widget causes zero CLS on host pages
- [ ] Widget script doesn't block page render
- [ ] Widget data endpoint responds in < 200ms (cached)
- [ ] Event ingestion handles 100+ concurrent requests

---

### Task 7.3 — Responsive Testing & Fixes

- [ ] Test dashboard on:
  - Desktop (1920px, 1440px, 1280px)
  - Tablet (768px, 1024px)
  - Mobile (375px, 414px)
- [ ] Test widget on:
  - Desktop: all 4 positions render correctly
  - Mobile: bottom-sheet layout works
  - Tablet: appropriate layout chosen
- [ ] Fix any responsive issues found
- [ ] Test touch interactions on mobile (swipe to dismiss, tap to play)

**Expected Outcomes:**
- [ ] Dashboard is fully usable on all screen sizes
- [ ] Widget renders correctly on mobile, tablet, and desktop
- [ ] No horizontal overflow on any viewport
- [ ] Touch interactions work on mobile devices

---

### Task 7.4 — Cross-Browser Testing

- [ ] Test dashboard on: Chrome, Firefox, Safari, Edge
- [ ] Test widget on: Chrome, Firefox, Safari, Edge (both desktop and mobile)
- [ ] Verify Shadow DOM works correctly across browsers
- [ ] Verify `navigator.sendBeacon` fallback for unsupported browsers
- [ ] Fix any cross-browser issues

**Expected Outcomes:**
- [ ] Dashboard works on all 4 major browsers
- [ ] Widget works on all 4 major browsers
- [ ] No browser-specific visual bugs
- [ ] Analytics events are sent in all browsers

---

### Task 7.5 — Marketing / Landing Page

- [ ] Create `apps/dashboard/app/(marketing)/page.tsx` — landing page
  - Hero section: headline, subheadline, CTA button (sign up)
  - How it works: 3-step illustration (paste link → customize → embed)
  - Feature highlights: contextual matching, smart triggers, conversion tracking
  - Social proof section (placeholder for testimonials about Vouchreel itself)
  - Pricing section (link to or embed the pricing page)
  - Footer: links, copyright
- [ ] Create `apps/dashboard/app/(marketing)/layout.tsx` — marketing layout (no sidebar)
- [ ] SEO: proper `<title>`, meta description, Open Graph tags
- [ ] Responsive across all devices

**Expected Outcomes:**
- [ ] Landing page is visually polished and professional
- [ ] CTA button links to signup
- [ ] How-it-works section clearly explains the product
- [ ] Page is responsive and fast-loading
- [ ] SEO meta tags are in place

---

### Task 7.6 — Deployment Pipeline

- [ ] **Vercel deployment**:
  - Create `vercel.json` if needed (usually works out of the box with Next.js)
  - Verify `next.config` uses `output: 'standalone'` or is compatible
  - Environment variables documentation for Vercel dashboard
- [ ] **VPS / Docker deployment**:
  - Create `Dockerfile` for the dashboard app:
    - Multi-stage build (deps → build → production)
    - Uses `output: 'standalone'` from Next.js
    - Runs on port 3000
  - Update `docker-compose.yml` to include both Postgres and the dashboard app
  - Create `docker-compose.production.yml` with production overrides
- [ ] **Widget CDN deployment**:
  - Document how to serve `vouchreel-widget.js` from a CDN
  - Option 1: serve from the Next.js app's `/public` or a Route Handler
  - Option 2: upload to CDN (Cloudflare, BunnyCDN, S3) as part of build
- [ ] Create a deployment guide in `docs/deployment.md`

**Expected Outcomes:**
- [ ] `docker build` succeeds and produces a working container
- [ ] `docker compose up` starts both Postgres and the app
- [ ] App works when deployed to Vercel (or locally simulated)
- [ ] Widget script is servable from a CDN or the app itself
- [ ] Deployment guide covers both VPS and Vercel

---

### Task 7.7 — Error Handling & Edge Cases

- [ ] Dashboard: add global error boundary (`error.tsx` in App Router)
- [ ] Dashboard: add `not-found.tsx` for 404 pages
- [ ] Dashboard: add loading states (`loading.tsx`) for all dashboard routes
- [ ] API routes: ensure all return consistent error response format:
  ```json
  { "error": { "code": "NOT_FOUND", "message": "Space not found" } }
  ```
- [ ] Widget: verify all failure modes fail silently (no console errors in production)
- [ ] Test: expired session → redirect to login
- [ ] Test: deleted space → appropriate error shown

**Expected Outcomes:**
- [ ] Error boundary catches and displays errors gracefully
- [ ] 404 page is styled and helpful
- [ ] All routes have loading states
- [ ] API errors are consistent and informative
- [ ] Widget never breaks the host site under any circumstance

---

### Task 7.8 — Documentation

- [ ] Update root `README.md` with final setup instructions
- [ ] Create `docs/deployment.md` — VPS and Vercel deployment guides
- [ ] Create `docs/widget-integration.md` — guide for site owners embedding the widget
- [ ] Ensure all env vars are documented in `.env.example`
- [ ] Add inline code comments where logic is non-obvious

**Expected Outcomes:**
- [ ] New developer can set up the project from the README
- [ ] Deployment guide covers both VPS and Vercel
- [ ] Widget integration guide is clear for non-technical users
- [ ] All env vars are documented

---

## Sprint 7 — Verification Checklist (MVP Complete)

- [ ] Lighthouse Accessibility score ≥ 90 on dashboard pages
- [ ] Lighthouse Performance score ≥ 80 on dashboard pages
- [ ] Widget causes zero CLS on test page
- [ ] Widget bundle < 15 KB gzipped
- [ ] Dashboard works on Chrome, Firefox, Safari, Edge
- [ ] Widget works on Chrome, Firefox, Safari, Edge
- [ ] Dashboard is responsive on mobile, tablet, desktop
- [ ] Widget responsive layout works on mobile
- [ ] Landing page is polished and professional
- [ ] Docker build succeeds and app runs in container
- [ ] Deployment guide covers VPS and Vercel
- [ ] Error boundaries catch all uncaught errors
- [ ] 404 page works
- [ ] All loading states display skeletons
- [ ] Full E2E flow works: signup → space → testimonial → widget config → embed → widget shows → analytics populate
- [ ] `turbo build` passes
- [ ] `turbo test` passes
