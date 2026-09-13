# Sprint 5: Embed Widget

**Phase**: MVP (Phase 1)
**Estimated effort**: 5–7 days
**Dependencies**: Sprint 3 (testimonials API), Sprint 4 (widget config API)
**Goal**: Build the core product — the vanilla JS embed widget that runs on customer websites. Includes the loader, Shadow DOM renderer, trigger system, video player (lazy-loaded), URL matcher, analytics beacons, and responsive styling. After this sprint, pasting the embed snippet into any HTML page displays a working testimonial widget.

---

## Tasks

### Task 5.1 — Widget Data API Endpoint

- [ ] Create `apps/dashboard/app/api/widget/[embedKey]/route.ts`
  - Accepts `embedKey` as path param
  - Returns JSON:
    ```json
    {
      "config": { "position": "...", "theme": {...}, "trigger": {...} },
      "testimonials": [
        { "id": "...", "videoUrl": "...", "platform": "...", "thumbnailUrl": "...", "title": "...", "quote": "...", "customerName": "...", "matchRules": {...} }
      ],
      "conversionGoals": [...]
    }
    ```
  - Only returns active testimonials
  - Set aggressive cache headers (`Cache-Control: public, max-age=60, s-maxage=300`)
  - CORS headers allowing any origin (`Access-Control-Allow-Origin: *`)
- [ ] Create `apps/dashboard/app/api/events/route.ts`
  - POST: accepts batched event payloads `{ events: [...] }`
  - Validates `spaceId` exists
  - Inserts into `events` table
  - Rate-limit: max 100 events per session per 10 minutes
  - CORS headers allowing any origin

**Expected Outcomes:**
- [ ] `GET /api/widget/{embedKey}` returns config + testimonials JSON
- [ ] Response includes correct CORS headers
- [ ] Response is cacheable
- [ ] Only active testimonials are included
- [ ] `POST /api/events` accepts and stores events
- [ ] Rate limiting prevents abuse

---

### Task 5.2 — Widget Loader (`loader.js`)

- [ ] Create `packages/widget/src/loader.js`
  - Reads `embedKey` from the script tag's `data-key` attribute or the script src path
  - Fetches widget data from `/api/widget/{embedKey}`
  - On success: initializes the widget
  - On failure: silently exits (never throws errors on the host page)
  - Defers execution until DOM is ready (`DOMContentLoaded` or `document.readyState`)
- [ ] Script must be async and non-blocking

**Expected Outcomes:**
- [ ] Script loads without blocking page render
- [ ] Correctly extracts `embedKey` from the script tag
- [ ] Fetches widget data from the API
- [ ] Fails silently if API is unreachable or returns error

---

### Task 5.3 — Shadow DOM Renderer (`widget.js`)

- [ ] Create `packages/widget/src/widget.js`
  - Creates a container `<div>` and attaches a Shadow DOM (`attachShadow({ mode: 'open' })`)
  - Injects scoped styles into the shadow root
  - Renders the widget in collapsed state:
    - Thumbnail image
    - Play button overlay
    - Customer name / quote snippet
    - Close (X) button
  - On click: expand to a larger player view
    - Larger video area
    - Full quote display
    - Customer name + company
    - Close button
    - Auto-advance to next testimonial (if multiple)
  - On dismiss (X or Escape key): hide widget, set `sessionStorage` flag to prevent re-show
  - Widget position determined by `config.position` value
- [ ] Animations: ease-in on show, ease-out on dismiss (respect `prefers-reduced-motion`)

**Expected Outcomes:**
- [ ] Widget renders inside Shadow DOM (no CSS leaks to/from host page)
- [ ] Collapsed state shows thumbnail + play button
- [ ] Click expands to full player view
- [ ] Escape key dismisses the widget
- [ ] Close button dismisses the widget
- [ ] Widget positions correctly in all 4 positions (bottom-right, bottom-left, bottom-bar, story-strip)
- [ ] Animations respect `prefers-reduced-motion`

---

### Task 5.4 — Trigger System (`triggers.js`)

- [ ] Create `packages/widget/src/triggers.js`
  - `delay`: show widget after `N` seconds via `setTimeout`
  - `exit-intent`: desktop — `mouseleave` on `<html>` targeting top edge; mobile — rapid scroll-up detection
  - `scroll-depth`: create an `IntersectionObserver` on a sentinel element placed at `N%` scroll depth
  - `pageview-count`: increment `sessionStorage` counter, show on Nth view
  - `returning-visitor`: check `localStorage` flag; set it on first visit, trigger on subsequent
- [ ] Only one trigger active at a time (per config)
- [ ] Once triggered, widget stays visible until dismissed
- [ ] Do not re-trigger in the same session if dismissed

**Expected Outcomes:**
- [ ] `delay` trigger shows widget after configured seconds
- [ ] `exit-intent` triggers on mouse leaving viewport (desktop)
- [ ] `scroll-depth` triggers when user scrolls past configured percentage
- [ ] `pageview-count` triggers on the Nth pageview in the session
- [ ] `returning-visitor` triggers only for users who have visited before
- [ ] Dismissed widget does not re-trigger in the same session

---

### Task 5.5 — Video Player (`player.js`)

- [ ] Create `packages/widget/src/player.js`
  - **YouTube**: show static thumbnail initially → on click, replace with `<iframe src="https://www.youtube-nocookie.com/embed/{videoId}?autoplay=1&rel=0">` (lazy-load)
  - **Vimeo**: show static thumbnail → on click, replace with Vimeo player iframe
  - **MP4**: show static thumbnail → on click, render `<video>` element with native controls
  - Muted autoplay preview (if `autoplayPreview` is true):
    - For YouTube/Vimeo: show animated thumbnail or short preview GIF
    - For MP4: render `<video muted autoplay loop playsinline>` with the first few seconds
  - Handle play/pause state transitions
- [ ] Never load iframes until user clicks (privacy + performance)

**Expected Outcomes:**
- [ ] YouTube videos show a thumbnail, load iframe only on click
- [ ] Uses `youtube-nocookie.com` domain (no cookies)
- [ ] Vimeo videos show thumbnail, load iframe on click
- [ ] MP4 videos play in a native `<video>` element
- [ ] Muted autoplay preview works when enabled
- [ ] No third-party iframes loaded until user interaction

---

### Task 5.6 — URL Matcher (`matcher.js`)

- [ ] Create `packages/widget/src/matcher.js`
  - Accepts testimonials array + current `window.location`
  - For each testimonial, evaluate `matchRules`:
    - `mode: "all"` → always include
    - `mode: "specific"` → check `urlPatterns` against current pathname
      - Support glob patterns: `*` matches any segment, `**` matches any path
      - Support exact matches
    - Check `tags` array for page-level tag matching (via `data-vouchreel-tags` attribute on host page)
  - Return filtered + sorted array of matching testimonials
  - If no matches, return empty (widget stays hidden)
- [ ] Write thorough unit tests for pattern matching

**Expected Outcomes:**
- [ ] "Show on all pages" testimonials always match
- [ ] `/products/*` matches `/products/shoes` but not `/about`
- [ ] Exact patterns like `/pricing` match only that path
- [ ] Tag-based matching works via host page data attributes
- [ ] Empty result = widget does not show
- [ ] Unit tests cover edge cases (trailing slashes, query strings, etc.)

---

### Task 5.7 — Analytics Beacon (`analytics.js`)

- [ ] Create `packages/widget/src/analytics.js`
  - Track events: `impression` (widget shown), `play` (video played), `click` (CTA clicked)
  - Generate or retrieve a `sessionId` (uuid stored in `sessionStorage`)
  - Batch events in memory, flush via `navigator.sendBeacon` on `visibilitychange` or after 5-second debounce
  - Payload format:
    ```json
    { "events": [{ "spaceId": "...", "testimonialId": "...", "sessionId": "...", "eventType": "play", "pageUrl": "...", "timestamp": "..." }] }
    ```
  - Conversion tracking: if `conversionGoals` exist, check if current page matches goal URL → fire `convert` event
- [ ] Never send PII in event payloads

**Expected Outcomes:**
- [ ] `impression` event fires when widget becomes visible
- [ ] `play` event fires when user starts video playback
- [ ] Events are batched and sent via `sendBeacon`
- [ ] Conversion events fire when user visits the goal URL after seeing a testimonial
- [ ] Session ID is consistent within a browser session
- [ ] No PII is included in events

---

### Task 5.8 — Responsive Styles (`styles.css`)

- [ ] Create `packages/widget/src/styles.css`
  - Desktop: floating card in configured corner position
  - Mobile (< 640px): bottom-sheet layout that slides up from bottom
  - Story-strip position: horizontal strip at bottom of viewport
  - Bottom-bar position: full-width bar at bottom
  - Touch-friendly: min 44px tap targets
  - Smooth transitions: slide-in, expand, dismiss
  - Dark mode support (matches `config.theme.mode`)
  - Custom properties for theme colors
  - No layout shift (CLS): widget uses `position: fixed`

**Expected Outcomes:**
- [ ] Desktop layout matches configured position
- [ ] Mobile layout uses bottom-sheet
- [ ] Touch targets are at least 44px
- [ ] Animations are smooth and respect `prefers-reduced-motion`
- [ ] Widget does not cause CLS on the host page
- [ ] Theme colors from config are applied

---

### Task 5.9 — Build Pipeline

- [ ] Configure esbuild to bundle all widget source files into a single `vouchreel-widget.js`
- [ ] Inline CSS into the JS bundle (injected into Shadow DOM)
- [ ] Minify and tree-shake
- [ ] Output to `packages/widget/dist/`
- [ ] Add a build size check script that fails if gzipped size exceeds 15 KB
- [ ] Add `widget:build` script to Turborepo pipeline
- [ ] Create a test HTML page (`packages/widget/test/index.html`) for manual testing

**Expected Outcomes:**
- [ ] `turbo run widget:build` produces `packages/widget/dist/vouchreel-widget.js`
- [ ] Bundle is under 15 KB gzipped
- [ ] Test HTML page loads the widget and it functions correctly
- [ ] CSS is scoped inside Shadow DOM (no leaks)

---

## Sprint 5 — Verification Checklist

- [ ] Widget data API returns correct JSON with CORS headers
- [ ] Embedding `<script>` tag in a test HTML page shows the widget
- [ ] Widget renders inside Shadow DOM (inspect: no CSS leaks)
- [ ] Delay trigger shows widget after configured seconds
- [ ] Exit-intent trigger fires on mouse leave (desktop)
- [ ] Scroll-depth trigger fires at configured percentage
- [ ] YouTube video shows thumbnail → click loads iframe via `youtube-nocookie.com`
- [ ] Vimeo video shows thumbnail → click loads iframe
- [ ] MP4 video plays in native `<video>` element
- [ ] URL matcher correctly filters testimonials by page
- [ ] Analytics events are sent via `sendBeacon`
- [ ] Dismiss (X or Escape) hides widget and prevents re-trigger
- [ ] Mobile layout uses bottom-sheet
- [ ] Bundle size < 15 KB gzipped
- [ ] `turbo build` passes
- [ ] `turbo test` passes (unit tests for matcher, triggers)
