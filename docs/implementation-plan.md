# Vouchreel — Comprehensive Development Plan

A video-testimonial widget SaaS that lets any website owner paste a video link and instantly get a floating widget playing customer testimonials on their site. This plan covers the full build from greenfield through MVP to Phase 2.

---

## Decisions Confirmed

| Decision | Choice | Rationale |
|---|---|---|
| **Database** | PostgreSQL + Drizzle ORM | No vendor lock-in — works on any VPS or managed Postgres (Neon, Railway, RDS, etc.) |
| **Auth** | BetterAuth (v1.7.4) | Framework-agnostic, self-hosted, supports email/password + OAuth, session management, RBAC |
| **Payments** | Stripe + Dodo Payments (admin toggle) | Dual payment provider, admin dashboard controls which is active |
| **Storage** | Pluggable adapter (S3 / Cloudflare R2 / Bunny.net) | Configurable via env vars — swap providers without code changes |
| **AI auto-clipping** | Deferred to Phase 2, placeholder stubs in MVP | Schema & API stubs built now so the integration slot is ready |
| **Design** | Decide direction as we build | Clean, modern SaaS aesthetic; shadcn/ui as the component system |
| **Hosting** | Flexible — VPS or Vercel | Dockerfile for VPS, `next.config` compatible with Vercel; domain deferred |

---

## Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| **Dashboard (frontend)** | Next.js (App Router) + Tailwind CSS + shadcn/ui | 16.3.5 | Latest stable, Turbopack default, great DX |
| **Backend / API** | Next.js Route Handlers | 16.3.5 | Co-located with dashboard, reduces infra |
| **Database** | PostgreSQL + Drizzle ORM + drizzle-kit | Latest | Type-safe schema, zero vendor lock-in, migrations via drizzle-kit |
| **Auth** | BetterAuth | 1.7.4 | Self-hosted, email/password + OAuth, session management, RBAC via plugins |
| **Payments** | Stripe + Dodo Payments | Latest SDKs | Admin-switchable dual provider |
| **Embed widget** | Vanilla JS (no framework) + Shadow DOM | Custom | Per spec: lightweight, no CSS collisions, <15 KB gzipped |
| **File/video storage** | Pluggable adapter (S3 / R2 / Bunny.net) | — | Configured via env vars, abstract interface |
| **Analytics pipeline** | PostgreSQL events table (MVP) → dedicated store at scale | — | Simple start; migrate to ClickHouse/Tinybird if volume demands |
| **AI clipping (Phase 2)** | Whisper + LLM (Gemini/GPT) + FFmpeg | — | Placeholder stubs in MVP, full pipeline in Phase 2 |
| **Monorepo tooling** | Turborepo | Latest | Parallel builds, caching across packages |

---

## Phase 1: MVP

Covers everything in [video-testimonial-widget-mvp-spec.md](file:///c:/vouchreel/video-testimonial-widget-mvp-spec.md). Target: a fully functional product that a real customer can install and use.

---

### Component 1: Project Scaffolding & Database

#### [NEW] Monorepo structure

```
vouchreel/
├── apps/
│   └── dashboard/              # Next.js 16 app (dashboard + API + marketing)
│       ├── app/
│       │   ├── (auth)/         # Login, signup, password reset
│       │   ├── (dashboard)/    # Authenticated dashboard routes
│       │   ├── (marketing)/    # Landing page, pricing
│       │   └── api/            # Route Handlers
│       ├── lib/
│       │   ├── db/             # Drizzle schema, client, migrations
│       │   ├── auth/           # BetterAuth config
│       │   ├── payments/       # Payment provider abstraction
│       │   └── storage/        # Storage adapter interface
│       └── components/         # Shared UI components (shadcn/ui)
├── packages/
│   └── widget/                 # Vanilla JS embed widget (bundled separately)
│       ├── src/
│       └── dist/               # Built widget script
├── drizzle/
│   └── migrations/             # SQL migration files (drizzle-kit)
├── turbo.json
├── package.json
├── .env.example
└── docker-compose.yml          # Local Postgres for dev
```

#### [NEW] Drizzle schema (`apps/dashboard/lib/db/schema.ts`)

Core data model from the spec, fully typed:

```typescript
// spaces
spaces: {
  id: uuid, name: text, ownerId: uuid (FK→users),
  embedKey: text (unique), createdAt: timestamp
}

// testimonials
testimonials: {
  id: uuid, spaceId: uuid (FK→spaces),
  videoUrl: text, platform: enum('youtube','vimeo','mp4'),
  thumbnailUrl: text, title: text, durationSeconds: integer,
  quote: text, customerName: text, customerCompany: text,
  tags: text[], matchRules: jsonb, sortOrder: integer,
  isActive: boolean, createdAt: timestamp,
  // Phase 2 placeholder fields:
  clipStatus: enum('none','pending','processing','done','failed'),
  clipUrl: text (nullable), transcriptUrl: text (nullable)
}

// widget_configs
widgetConfigs: {
  id: uuid, spaceId: uuid (FK→spaces, unique),
  position: enum('bottom-right','bottom-left','bottom-bar','story-strip'),
  theme: jsonb, triggerType: enum('delay','exit-intent','scroll-depth',
    'pageview-count','returning-visitor'),
  triggerValue: jsonb, pagesIncluded: text[], pagesExcluded: text[],
  autoplayPreview: boolean, createdAt: timestamp
}

// events
events: {
  id: uuid, spaceId: uuid, testimonialId: uuid,
  sessionId: text, eventType: enum('impression','play','click','convert'),
  pageUrl: text, timestamp: timestamp, metadata: jsonb
}

// conversion_goals
conversionGoals: {
  id: uuid, spaceId: uuid (FK→spaces),
  goalType: enum('url-match','pixel'), goalValue: text,
  createdAt: timestamp
}
```

> **AI auto-clipping placeholder**: The `clipStatus`, `clipUrl`, and `transcriptUrl` fields on `testimonials` are included from day one. The dashboard will show a "Coming soon — AI auto-clipping" badge where relevant. No processing pipeline is built in MVP, but the schema is ready.

---

### Component 2: Auth (BetterAuth)

#### [NEW] `apps/dashboard/lib/auth/` — BetterAuth configuration

- BetterAuth server instance with PostgreSQL adapter (via Drizzle)
- Email/password signup + login
- Google OAuth (expand to GitHub, etc. later)
- Password reset flow
- Session management with secure cookies
- RBAC plugin (roles: `owner`, `editor`, `viewer`) — schema ready for Phase 2 multi-seat

#### [NEW] `apps/dashboard/app/(auth)/` — Auth pages

- `/login` — Email + password, OAuth buttons
- `/signup` — Create account, post-signup redirect to onboarding
- `/forgot-password` — Reset flow
- `/onboarding` — Create first space → paste first link → get embed snippet

---

### Component 3: Payments (Stripe + Dodo)

#### [NEW] `apps/dashboard/lib/payments/` — Payment provider abstraction

```typescript
// Abstract interface — admin toggles which provider is active
interface PaymentProvider {
  createCheckoutSession(params): Promise<CheckoutSession>
  createSubscription(params): Promise<Subscription>
  handleWebhook(request): Promise<WebhookResult>
  getSubscriptionStatus(customerId): Promise<SubscriptionStatus>
  cancelSubscription(subscriptionId): Promise<void>
}

class StripeProvider implements PaymentProvider { ... }
class DodoProvider implements PaymentProvider { ... }
```

- Admin setting in database controls active provider (`stripe` | `dodo`)
- Webhook endpoints for both: `/api/webhooks/stripe`, `/api/webhooks/dodo`
- Subscription plans table in DB: `plans` (id, name, price, interval, features, provider_plan_id)
- User subscription tracking: `subscriptions` (user_id, plan_id, status, provider_customer_id, current_period_end)

#### [NEW] Pricing page & checkout flow

- `/pricing` — Plan comparison cards
- Checkout redirects to Stripe or Dodo depending on admin config
- Post-checkout webhook updates subscription status

---

### Component 4: Dashboard — Testimonial Management (CRUD)

#### [NEW] `apps/dashboard/app/(dashboard)/spaces/` — Space management

- List spaces, create new space, edit space name, delete space

#### [NEW] `apps/dashboard/app/(dashboard)/spaces/[id]/testimonials/` — Testimonial CRUD

- **Add testimonial**: paste a URL → backend calls oEmbed API (YouTube / Vimeo) or probes MP4 for metadata → auto-populates thumbnail, title, duration
- **Edit testimonial**: update quote, customer name/company, tags, match rules, sort order, active/inactive toggle
- **Reorder**: drag-and-drop reordering (updates `sortOrder`)
- **Delete**: soft-delete with confirmation
- **AI clipping badge**: "Coming soon" label on each testimonial card where clipping will apply

#### [NEW] `apps/dashboard/app/api/oembed/` — oEmbed proxy endpoint

- Fetches `https://www.youtube.com/oembed?url=...` or `https://vimeo.com/api/oembed.json?url=...`
- For direct MP4: `HEAD` request for metadata, accepts manual thumbnail upload
- Validates URL format before fetching
- Returns normalized `{ thumbnail_url, title, duration, platform }`

---

### Component 5: Dashboard — Widget Customization

#### [NEW] `apps/dashboard/app/(dashboard)/spaces/[id]/widget/` — Widget settings

- **Position picker**: visual selector for bottom-right / bottom-left / bottom-bar / story-strip
- **Theme editor**: primary color, accent color, light/dark mode, border radius
- **Trigger configuration**: dropdown for trigger type + value inputs (delay seconds, scroll %, etc.)
- **Page targeting**: include/exclude URL pattern inputs (glob or regex)
- **Live preview**: renders an iframe preview of the widget with current settings
- **Embed snippet**: copy-to-clipboard `<script>` tag with the space's `embedKey`

---

### Component 6: Embed Widget (Vanilla JS)

This is the core product — the script that runs on customer websites.

#### [NEW] `packages/widget/src/`

| File | Responsibility |
|---|---|
| `loader.js` | Entry point loaded by `<script>` tag. Async, non-blocking. Fetches config + matched testimonials from API. |
| `widget.js` | Renders into a Shadow DOM. Floating card with thumbnail + play button. Click expands to larger player. Dismiss (X) or auto-advance. |
| `triggers.js` | `delay` (setTimeout), `exit-intent` (mouseleave / rapid scroll-up), `scroll-depth` (IntersectionObserver), `pageview-count` (sessionStorage), `returning-visitor` (localStorage) |
| `player.js` | Lazy-loads YouTube iframe (`youtube-nocookie.com`) or Vimeo iframe only on click. Native `<video>` for MP4. Static thumbnail until interaction. |
| `analytics.js` | Fires beacon events (`navigator.sendBeacon`) for impressions, plays, clicks. Batches to reduce requests. |
| `matcher.js` | Evaluates `matchRules` against `window.location` to select page-relevant testimonials. |
| `styles.css` | Scoped inside Shadow DOM. Responsive: mobile → bottom-sheet layout. |

**Build**: esbuild → single minified JS file, target <15 KB gzipped. Served from CDN.

#### [NEW] `apps/dashboard/app/api/widget/[embedKey]/` — Widget data endpoint

- Returns widget config + matched testimonials for a given embed key
- Heavily cached (CDN edge cache, short TTL)
- Lightweight JSON response

#### [NEW] `apps/dashboard/app/api/events/` — Analytics event ingestion

- Accepts batched beacon payloads
- Validates `spaceId`
- Inserts into `events` table
- Rate-limited per session to prevent abuse

---

### Component 7: Analytics Dashboard

#### [NEW] `apps/dashboard/app/(dashboard)/spaces/[id]/analytics/`

- **Overview cards**: total impressions, plays, clicks, conversions (if goal set)
- **Per-testimonial breakdown**: table with each testimonial's metrics
- **Time-series chart**: daily impressions/plays over last 30 days
- **Conversion tracking setup**: UI to define a goal URL or install a conversion pixel snippet

---

### Component 8: Contextual Matching (Differentiator #1)

Baked into testimonial CRUD (match rules field) and the widget's matcher module:

- Each testimonial gets a `matchRules` JSONB field:
  - URL pattern matching (glob: `/products/*`, exact: `/pricing`)
  - Product ID / tag matching
  - "Show everywhere" default
- Widget's `matcher.js` evaluates rules client-side against `window.location.pathname`
- Dashboard UI: URL pattern input with validation + "show on all pages" toggle

---

### Component 9: Conversion Attribution (Differentiator #2)

- Owner sets a goal URL (e.g., `/thank-you`) or installs a conversion pixel
- Widget script checks for goal completion in the session → fires `convert` event
- Analytics dashboard shows play-to-convert funnel

---

### Component 10: Storage Adapter

#### [NEW] `apps/dashboard/lib/storage/` — Pluggable storage interface

```typescript
interface StorageAdapter {
  upload(file: Buffer, key: string, options?: UploadOptions): Promise<string> // returns public URL
  delete(key: string): Promise<void>
  getSignedUrl(key: string, expiresIn?: number): Promise<string>
}

class S3Adapter implements StorageAdapter { ... }      // AWS S3
class R2Adapter implements StorageAdapter { ... }      // Cloudflare R2
class BunnyAdapter implements StorageAdapter { ... }   // Bunny.net Storage

// Selected via STORAGE_PROVIDER env var
```

- **MVP usage**: thumbnail uploads for MP4 testimonials, user avatars
- **Phase 2 usage**: native video collection uploads, AI-clipped output files
- Provider selection via `STORAGE_PROVIDER` env var (`s3` | `r2` | `bunny`)
- Credentials via `STORAGE_*` env vars (key, secret, bucket/zone, region)

---

### Component 11: Non-Functional Requirements & Polish

- **Performance**: widget bundle <15 KB gzipped, async loading, zero CLS
- **Accessibility**: keyboard-dismissible (Escape), `aria-label` on all interactive elements, focus trapping when expanded
- **Responsive**: mobile bottom-sheet layout, touch-friendly, respects `prefers-reduced-motion`
- **Security**: embed key is public but rate-limited; API endpoints validate ownership via BetterAuth sessions; CSP-compatible Shadow DOM
- **GDPR**: `youtube-nocookie.com`, no third-party cookies, no tracking until user interaction

---

## Phase 2: Post-MVP

Covers everything in [video-testimonial-widget-phase2-spec.md](file:///c:/vouchreel/video-testimonial-widget-phase2-spec.md). Only begin once MVP is validated with real users and paying customers.

---

### Component 12: Native Testimonial Collection

#### [NEW] Collection form builder & public form

- Owner generates a shareable collection link or embeddable form
- Customizable prompt, branding, optional incentive (discount code)
- In-browser video recording (MediaRecorder API / webcam)
- File upload fallback (drag-and-drop, mobile camera roll)
- Text testimonial option
- Uploads go through the pluggable storage adapter
- Transcoding pipeline (FFmpeg on serverless) to normalize format/resolution

---

### Component 13: AI Auto-Clipping (Activates Placeholder)

#### [NEW] Transcription + clipping pipeline

- Whisper API (or Gemini) for transcription → timestamped transcript
- LLM analysis → identifies strongest 15–30 second soundbite
- FFmpeg clipping with burned-in captions
- Updates `clipStatus`, `clipUrl`, `transcriptUrl` fields (schema already in place from MVP)
- Manual trim/adjust UI as fallback
- Works on both linked videos and natively collected videos

---

### Component 14: Reviews Import + Curated Templates

- Google Places API / Business Profile API (official only, no scraping)
- Trustpilot Business API
- Scheduled sync respecting rate limits
- 3–5 curated display templates: Wall of Love, Carousel, Story Strip, Minimal Card, Masonry
- Blend text reviews + video in same contextual matching engine

---

### Component 15: Social Repurposing (Growth Loop)

- One-click export to 9:16 vertical (TikTok/Reels/Shorts)
- FFmpeg rendering: aspect ratio, burned-in captions, branding
- Vouchreel watermark/link for organic acquisition
- Download; direct-post deferred to Phase 3

---

### Component 16: Platform Integrations

- **Shopify app**: native install, product-level matching via Shopify product IDs
- **WordPress plugin**: admin settings, Gutenberg block
- **Webflow / Framer**: custom embed components
- **Zapier / Make**: triggers (new testimonial) + actions (send request)
- **Public API + Webhooks**: REST CRUD, webhook events

---

### Component 17: Advanced Analytics, A/B Testing, Team & Agency

- A/B testing: split traffic between triggers, positions, templates
- Full funnel: impression → play → click → convert (segmented)
- Exportable PDF/CSV reports
- Multi-language captions (auto-detect locale, translate via API)
- Multi-seat accounts with roles (owner / editor / viewer)
- White-label tier (remove Vouchreel branding)
- Multi-space agency dashboard

---

## Build Order Summary

### MVP (Phase 1) — Sequential milestones

| # | Milestone | Components | Est. Effort |
|---|---|---|---|
| 1 | **Foundation** | Monorepo scaffold, Postgres + Drizzle schema, BetterAuth, storage adapter, docker-compose | ~3–4 days |
| 2 | **Payments** | Stripe + Dodo abstraction, plans, pricing page, checkout, webhooks | ~2–3 days |
| 3 | **Testimonial CRUD** | Dashboard CRUD, oEmbed proxy, contextual matching rules UI, AI-clipping placeholder stubs | ~3–4 days |
| 4 | **Widget customization** | Widget settings UI, live preview, embed snippet | ~2–3 days |
| 5 | **Embed widget** | Vanilla JS widget, Shadow DOM, lazy video, triggers, matcher, analytics beacons | ~5–7 days |
| 6 | **Analytics & attribution** | Event ingestion, analytics dashboard, conversion goals | ~3–4 days |
| 7 | **Polish & launch prep** | Responsive/a11y, perf optimization, marketing page, deployment pipeline | ~3–4 days |

**MVP total: ~21–29 days of focused development**

### Phase 2 — Priority order (per spec)

| # | Feature | Est. Effort |
|---|---|---|
| 1 | Native testimonial collection | ~7–10 days |
| 2 | AI auto-clipping (activate placeholder) | ~5–7 days |
| 3 | Reviews import + curated templates | ~5–7 days |
| 4 | Platform integrations (Shopify, WordPress, Webflow) | ~7–10 days |
| 5 | Social repurposing export | ~4–5 days |
| 6 | Advanced analytics / A/B testing | ~5–7 days |
| 7 | Team, agency, white-label | ~5–7 days |

---

## Verification Plan

### Automated Tests
- **Unit tests**: Drizzle schema validation, oEmbed proxy, URL matching logic, trigger modules, payment provider abstraction, storage adapter
- **Integration tests**: testimonial CRUD API, widget data endpoint, event ingestion, auth flows, payment webhooks
- **Widget tests**: headless browser tests for Shadow DOM rendering, trigger firing, lazy-load, bundle size assertion (<15 KB gzipped)
- **CI**: `turbo build` + `turbo test` succeeds across all packages

### Manual Verification
- **End-to-end flow**: signup → create space → paste YouTube link → auto-fetch → customize widget → copy embed → paste into test HTML → widget appears → play video → check analytics
- **Mobile**: test on real iOS + Android devices
- **Performance**: Lighthouse audit on test page with widget (target: 0 CLS, no render blocking)
- **Cross-browser**: Chrome, Firefox, Safari, Edge
- **Payments**: test checkout flow with both Stripe test mode and Dodo sandbox
