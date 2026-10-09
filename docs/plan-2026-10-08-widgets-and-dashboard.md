# Implementation plan: widgets, widget editor and user dashboard, 2026-10-08

Covers six requests:

1. More widgets to choose from.
2. Better widget layouts and shapes (square, rectangle, circle, vertical reel, rounded square, and so on).
3. Easy styling of widget appearance.
4. A redesigned widget editor with a real, live preview while designing.
5. A user dashboard (today login goes straight to Spaces).
6. Other worthwhile opportunities, without bloat or drift.

Facts below come from reading the code on `feat/video-themes` (base `64cf626`). Sizes are rough (S = a day or less,
M = a few days, L = about a week or more) and are guesses, not measurements. Nothing here has been started.

---

## 1. What the code does today

### Widget runtime (`packages/widget`)

- Vanilla TS in a Shadow DOM, built by esbuild into one IIFE file, `dist/vouchreel-widget.js`.
- **Five templates**: `floating-card`, `story-strip` (floating), `wall-of-love`, `carousel`, `masonry` (inline).
  All five live in one file, `widget.ts` (1,203 lines), dispatched by a `switch` in `renderTemplate()`.
- **Four positions**: `bottom-right`, `bottom-left`, `bottom-bar`, `story-strip`.
- **Inline placement**: the first `[data-vouchreel-embed]` element on the page, or the template itself being inline.
  Only one widget per page and per space.
- **Theme**: four values only: `primaryColor`, `accentColor`, `mode` (light/dark), `borderRadius` (0 to 24 px),
  applied as CSS custom properties (`--vr-primary`, `--vr-accent`, `--vr-radius`). The stylesheet already has a
  good token layer (`--vr-bg`, `--vr-text`, `--vr-shadow`, ...), so new style options can be added as variables cheaply.
- **Size budget is nearly spent.** `check-size.mjs` fails the build above 15 KB gzip. The current build is
  **15,176 of 15,360 bytes (184 bytes left)**, which matches the C3 note in `docs/gaps-register.md`.
  No new layout fits without changing how the bundle is split. This is the biggest constraint in this plan.

### Data (`apps/dashboard/lib/db/schema.ts`)

- `widget_configs` has a **unique** `space_id`: exactly one widget per space.
- `template`, `position`, `trigger_type` are Postgres enums, so new values need a migration.
- `theme` is `jsonb`, so new style fields need no migration, only validation and defaults.
- `events` (`impression`, `play`, `click`, `convert`) carry `space_id` and `testimonial_id`, not which widget.

### Widget editor (`app/(dashboard)/spaces/[id]/widget/page.tsx`)

- One long page: template picker, position picker, theme editor, triggers, targeting, save card, embed snippet,
  with a sticky preview on the right.
- **The preview is a React re-implementation, not the real widget** (`components/widget/preview/template-previews.tsx`,
  `preview-modals.tsx`). It only draws `wall-of-love`, `carousel` and `masonry`. **Choosing `floating-card`
  (the default) or `story-strip` shows a mock website with no widget on it.** That is the "cannot see the sample"
  problem. Because it is a copy, it will also drift from the real widget every time the widget changes.
- Theme editing is two colour pickers, a mode switch and a radius slider. No presets, shapes, sizes or element toggles.
- Save is manual, there is no draft or undo, and the save control appears twice.

### Dashboard

- `app/(dashboard)/dashboard/page.tsx` counts the user's spaces and redirects to `/onboarding` (none) or `/spaces`.
  There is no home page. The sidebar has Spaces, Agency, Billing, Settings, Admin.
- Data for a home page already exists: `events` (with a `space_id, event_type, timestamp` index), pending
  submissions (the Collect tab badge), the notification inbox, and per-space analytics.

---

## 2. Design decisions

### D1. Separate "layout" from "shape"

Today a template mixes two things: how items are arranged and what each item looks like. Split them:

- **Layout**: where and how items are arranged (floating bubble, carousel, grid, reel feed, ...).
- **Shape**: the media frame of each item (circle, square, rounded square, landscape 16:9, portrait 4:5, vertical 9:16).

A user picks a layout, then a shape that the layout supports. This gives many combinations from a small amount of
code, which is how we get "more widgets" without writing a new renderer for each one.

### D2. One style model, expressed as CSS variables

All appearance options become fields of a versioned `style` object stored in the existing `theme` jsonb column, and
the widget maps them to CSS custom properties on `.vr-theme-root`. The renderer code never branches on colours or
sizes; the stylesheet does the work. This keeps per-option cost in the bundle to a few bytes.

### D3. The preview runs the real widget

The editor preview loads the actual widget bundle inside a sandboxed `iframe` and receives the draft config through
`postMessage`. What the user sees is what visitors get, by construction. The React copies of the templates are deleted.

### D4. Split the widget bundle into a core plus one chunk per layout

- **Core** (budget stays 15 KB gzip): loader, triggers, analytics, matcher, player, expanded video/review modal,
  shared card rendering, base CSS and tokens.
- **Layout chunks** (budget 5 KB gzip each, enforced by `check-size.mjs`): one file per layout with its own CSS,
  fetched once the config says which layout to show. Each chunk registers itself on a small global the core reads.
- The widget API response includes the chunk URL (content-hashed, long cache), so the core can start fetching it
  in parallel with the testimonials. Floating layouts load after a trigger anyway, so the extra request is hidden.
- The customer's CSP already has to allow our script origin, so a chunk from the same origin needs no new rule.
- **Decision needed (Q1)**: whether the default `floating-card` layout stays inside the core to avoid any extra
  request for the most common setup. Recommendation: yes, if it fits after moving the other four layouts out.

### D5. Brand kit still wins

A saved brand kit already overrides colours, radius and fonts (`lib/brand-kit/theme.ts`). Keep that rule. The editor
shows brand-managed fields as locked with a link to the Brand tab, as it does now, and new fields (shape, size,
shadow, element toggles, ...) remain per widget.

---

## 3. Order and why

| Phase | Items | Why here |
|---|---|---|
| A. Foundations | A1 bundle split, A2 style model v2, A3 real-widget preview harness | Every later item depends on these. A1 unblocks new layouts, A3 unblocks the editor. |
| B. Dashboard | B1 home page | Independent of widgets. Can run in parallel with Phase A. Quick visible win. |
| C. Editor | C1 editor redesign, C2 style presets | Needs A2 and A3. Delivers requests 3 and 4 on the current five templates before any new layout ships. |
| D. Widgets | D1 shapes, D2 new layouts, D3 multiple widgets per space | Needs A1 and C1. D3 is what lets a floating widget and an inline widget run on the same site. |
| E. Opportunities | E1 to E6 | Each is small and builds on the above. Pick by value. |

Each item is its own change set: one branch, its own tests, and CI green on Chromium, Firefox and WebKit before it is
called done (same rule as the earlier plans: done means a test or a run shows it).

---

## Phase A: foundations

**Status (2026-10-08): done on `feat/video-themes`, not yet committed.** What came out of it:
- Core bundle 15,176 to 14,220 bytes gzip with the style system included (1,140 bytes left). The plan said
  3 KB of headroom; the split alone gave 1.8 KB and the style options cost about 700 bytes. New layouts live in
  chunks, so the core only has to pay for shape rules on the floating card (D1). Each chunk is 1 to 2.6 KB.
- Found and fixed on the way: inline layouts were `position: fixed` (the shadow host's default), so a wall of
  love floated over the page as one narrow column on real sites; the review dialog still wrote the reviewer's
  name into the page as HTML (the C3 fix covered the cards but not the dialog).
- Theme field names were kept (`borderRadius`, not `cornerRadius`) because the brand kit overrides them by name.
- The preview page is a static `public/widget/preview.html` with its own strict CSP, frameable by the dashboard
  only; sample posters are inline SVG, so the preview depends on no outside image host (Q3 partly answered:
  sample videos themselves are still to come).
- Not run here: the Playwright suite (no Postgres in this environment). The widget page browser test was
  rewritten for the new preview and needs a CI run.

### A1. Split the widget bundle (M)

**Plan**
1. Move each template renderer out of `widget.ts` into `src/layouts/<name>.ts` with its CSS in
   `src/layouts/<name>.css`. Shared pieces (card, play badge, stars, source badge, modal) stay in core.
2. Define a small layout contract: `register(name, { render(root, items, ctx), destroy() })`, where `ctx` gives the
   shared helpers (open modal, track event, announce). Chunks are IIFEs that call
   `window.__vouchreel.register(...)`.
3. esbuild: one entry for core, one per layout, content-hashed file names, a manifest the dashboard reads to build
   chunk URLs. Serve them from the existing widget route with immutable cache headers.
4. Core fetches the chunk named in the config; on failure it falls back to `floating-card` and reports an
   analytics error event once.
5. `check-size.mjs`: core ≤ 15 KB gzip, each layout ≤ 5 KB gzip, warning at 95% as today.

**Tests**: existing widget unit tests still pass; new loader tests for chunk fetch, fallback and double-register;
an e2e embed page for each of the five existing templates showing identical output before and after
(screenshot comparison).

**Done when**: all five templates render from chunks, core has at least 3 KB of headroom, no behaviour change for
existing embeds.

### A2. Style model v2 (M)

**Plan**
1. Extend `widgetThemeSchema` into a versioned style object (still stored in `widget_configs.theme`):

   | Group | Fields |
   |---|---|
   | Colours | `primaryColor`, `accentColor`, `background` (surface colour or `transparent`), `textColor` (auto by contrast unless set), `mode` |
   | Shape | `shape` (`circle`, `square`, `rounded`, `landscape`, `portrait`, `vertical`), `cornerRadius` (0 to 48), `size` (`sm`, `md`, `lg`) |
   | Surface | `shadow` (`none`, `soft`, `strong`), `borderWidth` (0 to 4), `borderColor`, `glass` (blurred translucent surface, on/off) |
   | Content | toggles for `showName`, `showCompany`, `showStars`, `showSource`, `showQuote`, `showPlayButton`; `playButtonStyle` (`circle`, `solid`, `minimal`) |
   | Layout | `columns` (grid layouts, 1 to 4), `gap` (`tight`, `normal`, `loose`), `autoAdvance` seconds for carousel and reel |
   | Motion | `entrance` (`none`, `fade`, `slide`, `pop`); always off under `prefers-reduced-motion` |
   | Type | stays with the brand kit (`fontMode`, `fontFamily`); no per-widget font in this phase |

2. `normalizeStyle(raw)` in a shared module used by the API, the editor and the widget: fills defaults, upgrades
   v1 (`borderRadius` becomes `cornerRadius`, everything else defaulted to today's look), clamps values.
   Existing widgets must look exactly the same after the upgrade.
3. Widget: map each field to a CSS variable or a class on `.vr-theme-root` (`--vr-radius`, `--vr-shadow`,
   `--vr-border`, `vr-shape-vertical`, `vr-hide-company`, ...).
4. Contrast guard: reuse `contrastBetween` and `MIN_BUTTON_CONTRAST` from `lib/brand-kit/theme.ts`; the API
   rejects or the editor warns on unreadable text/background pairs.

**Tests**: schema tests (defaults, clamping, v1 upgrade), a widget test per field that the right variable or class
is set, a snapshot test that a v1 config renders identically.

### A3. Real-widget preview harness (M)

**Plan**
1. A preview build entry, `src/preview.ts`, that bundles core plus all layouts and listens for
   `{ type: "vouchreel:preview", config, items }` messages, re-rendering in place without reload.
   It does not count toward the production budget and is never served to customer sites.
2. A dashboard route `/widget/preview` (no app chrome) that hosts a neutral mock page (hero, text, a
   `[data-vouchreel-embed]` slot) and loads the preview build. Strict `postMessage` origin check both ways.
3. A React `WidgetPreviewFrame` component: sandboxed `iframe`, sends the draft config debounced at about 100 ms,
   width presets (desktop 1280, tablet 768, mobile 375, scaled to fit), host background toggle (light/dark/custom
   colour) so users can see the widget on a page like theirs.
4. Content: the space's real published testimonials and reviews when there are any, otherwise built-in sample
   items with sample videos and reviews, clearly labelled "Sample content".
5. Triggers do not wait in preview: the widget shows immediately, with a "Replay entrance" button.
6. Delete `components/widget/preview/*` and the template branches in `live-preview.tsx`.

**Tests**: e2e: change colour, shape and layout in the editor and assert the iframe's shadow DOM updates without a
reload; floating-card and story-strip are visible in the preview (regression for today's blank preview);
messages from a foreign origin are ignored.

---

## Phase B: dashboard

### B1. Home page at `/dashboard` (M)

**Status (2026-10-08): built on `feat/video-themes`, not yet committed.** `lib/home/queries.ts` (grouped
queries over the owner's spaces), `lib/home/format.ts` (the wording, tested), `components/home/*`. Differences
from the outline below: submissions are approved on the Collect tab (Home links there, it does not approve);
the numbers row is hidden until there is any activity; the spotlight's conversion line counts sessions that
played the video and converted afterwards, because conversion events carry no testimonial. No widget code
changed. The Postgres query test and the new browser test need a CI run.

Replace the redirect with a real page. Users with no spaces still go to `/onboarding`. Add "Home" as the first
sidebar item and make it the post-login landing page.

**Direction: half showcase, half instrument panel.** The product is video, so the home page should feel like
the owner's best customers talking, with the numbers as the supporting evidence, not a wall of twelve equal
tiles. Rules: one focal point per screen height, numbers always shown with what they mean, and nothing on the
page that has nothing to say (empty sections are hidden, not shown as zeros).

**Layout, top to bottom**
1. **Spotlight (creative).** A wide band with the week's best-performing testimonial playing muted on loop
   (by plays and conversions over 7 days), the customer's quote in large type beside it, and one plain
   sentence written from the numbers: "Sarah's video was watched 412 times this week and is on the page for
   38% of your conversions." Actions: "Share it" (opens the existing social export) and "See all".
   For a new account with no plays yet, the band becomes the setup checklist instead (step 2 moves up).
2. **Setup checklist** (only while incomplete): space created, first testimonial, widget styled, widget
   installed (first `impression` seen from a non-preview origin), collection link shared. A progress ring and
   one "next step" button rather than five equal rows.
3. **Pulse (analytical).** Four numbers for 7 or 30 days across all spaces: impressions, plays, play rate,
   conversions, each with a sparkline and the change against the previous period in words ("up 18%"). One
   query on `events` grouped by type and day, using the existing `events_space_type_ts_idx` index.
4. **Needs you**: pending submissions to approve (with the submitters' video thumbnails, approve from here),
   failed imports or video jobs, plan limits close to full. Hidden when empty.
5. **Wall of faces**: the latest approved testimonials as a strip of round video thumbnails (the story-strip
   look), which doubles as a quick way into each space.
6. **Spaces**: compact cards with a sparkline each, reusing the existing spaces view.

Recent notifications stay in the bell and the inbox; repeating them here would be noise.

Team members see the spaces they can access (same rules as `/spaces`). Agency users keep `/agency` for client
roll-ups; the home page does not duplicate it.

**Tests**: route tests for the aggregates (empty account, one space, team member access), e2e for the redirect
rules (no spaces goes to onboarding, otherwise lands on Home), checklist step detection.

---

## Phase C: editor

### C1. Widget editor redesign (L)

**Status (2026-10-08): built on `feat/video-themes`, not yet committed.** Migration 0038 adds `draft_config`
and `published_at` to `widget_configs`; `PUT .../widget-config/draft` autosaves, `DELETE` discards, and the
existing `PUT .../widget-config` now means Publish (it clears the draft). The page is a sticky top bar (status,
undo/redo with Ctrl+Z, Discard, Publish), six numbered collapsible steps, and the real-widget preview.
Not done from the outline below: layout cards use drawn sketches rather than live thumbnails; "which
testimonials to show" (all, tagged, hand-picked order) is left for later, since the widget has no setting for
it yet; the shape chips arrive with D1. The old template picker and theme editor are removed. No widget code
changed. The updated browser test (draft, reload, undo, publish, discard) needs a CI run.

**Layout (desktop)**: a three-part screen.

- **Top bar**: widget name, status pill (`Draft changes` / `Published`), Undo / Redo, device switch,
  `Publish` button. One save control, not two.
- **Left panel (about 360 px), stepped sections**, each collapsible and linkable:
  1. **Layout**: visual cards (small animated thumbnails drawn from the real widget, not icons) with a one-line
     "best for" hint ("Landing pages", "Product pages", "Mobile").
  2. **Shape and size**: shape chips limited to what the layout supports, size S/M/L, corner radius slider.
  3. **Style**: presets row (C2) first, then colours, surface (shadow, border, glass), dark/light.
  4. **Content**: element toggles, which testimonials to show (all, tagged, hand-picked order), include reviews.
  5. **Behaviour**: trigger, position (floating layouts only), page targeting, autoplay preview.
  6. **Install**: embed snippet for this widget and the install check (E2).
- **Right, the rest of the screen**: the live preview frame from A3, sticky, filling the height.

**Mobile**: preview on top in a collapsible sheet, sections as tabs underneath (replaces today's hidden-section
tabs).

**Behaviour**
- Every change updates the preview immediately; nothing waits for save.
- **Draft and publish**: edits autosave as a draft (add `draft_config jsonb` to `widget_configs`); visitors keep
  seeing the published config until `Publish`. "Discard draft" returns to the published state. This removes the
  risk that experimenting in the editor changes the live site.
- Undo/redo in memory for the session (a simple history stack of configs).
- Leaving with an unsaved draft is impossible (autosave), so the "unsaved changes" warnings go away.
- Every control has a label, keyboard access and visible focus; colour fields accept hex and show a contrast hint.

**Tests**: e2e for edit, autosave, reload keeps draft, publish changes what `/api/widget/[embedKey]` returns,
discard restores; unit tests for undo/redo; axe check on the editor page.

### C2. Style presets (S)

**Status (2026-10-08): built, not yet committed.** Six looks in `lib/widget-editor/presets.ts` (Minimal, Soft,
Bold, Glass, Dark cinema, Outline) at the top of the Style step. A look sets surfaces, corners, depth and motion
only, never the brand colours, so there is no separate "Brand" look. "Reel" waits for vertical shapes (D1).
Tests check each look is valid, normalizes to itself, has readable text, and differs from the others.

Six to eight curated presets, each a full style object: for example **Minimal**, **Bold**, **Glass**,
**Dark cinema**, **Soft**, **Brand** (built from the saved brand kit), **Reel** (vertical shape, glass, autoplay).
One click applies, then any field can be fine-tuned; the preset name shows "(edited)" once changed.
Presets are code constants validated by the same schema, not database rows. "Save as my preset" is deferred
until someone asks (see section 5).

**Tests**: every preset passes `normalizeStyle` unchanged and meets the contrast guard.

---

## Phase D: widgets

### D1. Shapes (M)

**Status (2026-10-08): built, not yet committed.** Six shapes (circle, square, rounded, wide 16:9, portrait 4:5,
reel 9:16) as CSS on the classes A2 already sets. The core paid 82 bytes gzip for the floating card's shapes
(1,058 bytes left); grid cards and the story strip carry theirs in their own chunks. Changes from the table
below: the floating card offers all six (a reel-shaped corner card is the "vertical like a reel" request), the
story strip also offers reel tiles, and the letterbox "fit" option is left out. Tall shapes make narrower cards
in carousels and grids, still scaled by the size option. The editor shows only the shapes a layout offers, its
own look first as "Default" (stored as null), and drops an unsupported shape when the layout changes.

Implement the six shapes from A2 as CSS on the shared card (`aspect-ratio`, `border-radius`, `object-fit`), with a
compatibility table so the editor only offers what works:

| Layout | Circle | Square | Rounded | Landscape 16:9 | Portrait 4:5 | Vertical 9:16 |
|---|---|---|---|---|---|---|
| Floating bubble | yes (default) | yes | yes | | | |
| Floating card | | yes | yes | yes (default) | yes | |
| Floating reel | | | yes | | | yes (default) |
| Story strip | yes (default) | | yes | | | |
| Carousel | | yes | yes | yes (default) | yes | yes |
| Wall of love / Masonry / Grid | | yes | yes | yes (default) | yes | yes |
| Reel feed | | | yes | | | yes (default) |
| Spotlight | | | yes | yes (default) | | yes |

Text-only review cards ignore the media shape and keep their own card. Videos are cropped with `object-fit: cover`
and the poster keeps the subject centred; a "fit" option (letterbox) is offered for landscape videos in vertical
frames.

**Tests**: widget test per shape class; e2e screenshot for each supported pair at desktop and mobile width.

### D2. New layouts (L, one change set per layout, each S to M)

**Progress (2026-10-09):** spotlight built (migration 0042): one large featured testimonial (poster, big quote,
name and company; reviews as text slides) with up to six small pictures to switch between, two columns wide and
one on narrow screens. Playback uses the core's pop-up, so the chunk is 2.27 KB gzip and the core is unchanged.
Optional auto-advance (the editor's auto-scroll control) pauses on hover or focus, stops once the visitor picks
one, and never runs for reduced motion. Shapes: wide (default), portrait, square, reel, rounded.

**Progress (2026-10-09):** reel feed built (migration 0041): an inline row of up to twelve 9:16 tiles (pictures,
no video downloaded until one is opened) that open a full-screen vertical player for uploaded videos: swipe up
or down, arrow keys or buttons, next video on its own when one ends, Escape or the close button to leave, focus
kept inside, page scroll locked while open. YouTube, Vimeo and reviews use the core's pop-up, which is the only
code that can play them. The player is in the chunk (2.65 KB gzip); core unchanged. Plays are counted
(`track` now accepts `play` for layouts). Shapes: reel (default), portrait, square, rounded.

**Progress (2026-10-09):** floating reel built too (migration 0040): a 9:16 corner card with story-style
progress bars, arrows and swipe to move through up to six slides (videos, then reviews as text slides), tap to
open the player. Chunk 2.25 KB gzip, core unchanged. One video is on the page at a time. It does not
auto-advance (no extra motion or video downloads the visitor did not ask for). Shapes: reel (default),
portrait, square, rounded.

**Progress (2026-10-08):** floating bubble built (migration 0039 adds the enum value). Its chunk is 1.43 KB
gzip; the core grew 19 bytes for two optional layout-contract members (`dismiss`, `autoplay`). Muted loops play
only for uploaded videos, when previews are on, and never for visitors who ask for reduced motion or reduced
data, so the bubble downloads no video for them. Shapes: circle (default), rounded, reel.

Each is a layout chunk from A1. Order by value:

| Layout | Placement | What it is | Why |
|---|---|---|---|
| **Floating bubble** | floating | A circle video bubble (muted loop) that expands into the player. The common "video bubble" pattern. | Most requested style in this market; small. |
| **Floating reel** | floating | A vertical 9:16 card in a corner, swipe/tap to the next video, like a story. | Matches the "vertical, like reel" request. |
| **Reel feed** | inline | A horizontal row of vertical 9:16 tiles; tapping opens a full-screen vertical player with swipe between videos. | Shoppable/social look, strong on mobile. |
| **Spotlight** | inline | One large featured testimonial (video or quote) with optional thumbnails to switch. | Hero sections and pricing pages. |
| **Grid** | inline | A fixed, even grid (unlike masonry), columns from the style object. | Clean, predictable layout many users expect. |
| **Marquee** | inline | An auto-scrolling row of text reviews and small video chips; pauses on hover and under reduced motion. | Social-proof strip for landing pages. |
| **Rating badge** | inline or floating | Aggregate stars and count ("4.9 from 312 reviews"), opens a panel with the reviews. | Tiny, works in headers and footers; uses data we already have. |

Schema: add the new values to `widget_template` (migration), keep old values. The template picker in C1 lists them
with live thumbnails. Each layout ships with keyboard navigation, focus trapping in the expanded player,
`aria-live` announcements (as the current templates do), and reduced-motion handling.

**Tests per layout**: unit tests for rendering and keyboard behaviour, an e2e embed page, size check under 5 KB gzip.

### D3. Multiple widgets per space (L)

One widget per space blocks the obvious setup: a floating bubble on every page plus a wall of love on the
testimonials page. More layouts are of limited use without this.

**Plan**
1. New `widgets` table: `id`, `space_id`, `name`, `template`, `position`, `style` (jsonb), `draft_config` (jsonb),
   trigger, targeting, `autoplay_preview`, `created_at`, `updated_at`. Migration copies each `widget_configs` row
   into one widget named "Default widget". Keep `widget_configs` readable for one release, then drop it.
2. Embeds:
   - The existing snippet (`/widget/<embedKey>.js`) keeps working: it shows the space's floating widgets whose
     page targeting matches, exactly as today.
   - Inline placement by id: `<div data-vouchreel-widget="<widgetId>"></div>`. The existing
     `[data-vouchreel-embed]` keeps meaning "the default widget".
   - One script per page still; the API returns the configs for the widgets that apply to the page.
3. Dashboard: the Widget tab becomes a list of widgets (name, layout thumbnail, status, last published, 30-day
   plays) with Create, Duplicate, Delete; each opens the C1 editor.
4. `events` gets a nullable `widget_id`; per-widget numbers in the list and in analytics filters.
5. Experiments: variants point at a widget id instead of the space config.
6. Plan limits: number of widgets per space by plan, set in the admin plans manager (for example Free 1,
   paid plans more). **Decision needed (Q2)**: the numbers.

**Tests**: migration test (one row in, one widget out, identical API response), API tests for multiple widgets and
targeting, e2e page with a floating and an inline widget at once, plan limit enforcement, events attributed to the
right widget.

---

## Phase E: other opportunities

Chosen because each one builds directly on the work above, uses data we already have, and helps a user get value
from the widget. Each is S or M.

| # | Opportunity | Why it is worth it | Size |
|---|---|---|---|
| E1 | **Copy style** between widgets and spaces ("Apply this style to...") | Agencies and multi-space owners restyle each space by hand today. Pure reuse of the style object. | S |
| E2 | **Install check** in the editor and the checklist: "Last seen on yourbrand.com 3 minutes ago" from the first impression event per origin, plus a "Check my page" button that fetches the URL server-side and looks for the snippet | The most common support question for embed products is "is it working?". Also drives the B1 checklist. | S |
| E3 | **Hosted wall page**: a public `/{space-slug}/wall` page rendering any inline widget, shareable without a website | Lets users with no site access (or link-in-bio users) show testimonials; reuses the layout chunks and the white-label rules. | M |
| E4 | **Style experiments**: let the existing experiments feature compare two widgets (layout or style), not only trigger/position/template | The experiments engine exists; this widens it to the new options and gives users a reason to try layouts. | S |
| E5 | **Per-widget performance in the editor**: impressions, plays, play rate and conversions for the published version, shown beside the preview | Closes the loop between design and results without opening Analytics. | S |
| E6 | **Publish history with one-click revert** (keep the last 10 published configs) | Safety net once publishing becomes easy; small table, no new UI pattern. | S |

---

## 4. Decisions needed before starting

| # | Question | Recommendation |
|---|---|---|
| Q1 | Keep `floating-card` in the core bundle? | **Decided: yes** (2026-10-08). Done in A1. |
| Q2 | Widgets per space per plan | **Approach decided, numbers open.** See "Widget limits without the clunk" below. |
| Q3 | Sample content in preview when a space has none | Ship three sample videos and six sample reviews as static assets on our CDN. |
| Q4 | Draft and publish, or keep instant save | Draft and publish (C1). Instant save to a live site is risky with a richer editor. |
| Q5 | Dashboard order: checklist first or numbers first | Checklist first while incomplete, then numbers first. |

---

### Widget limits without the clunk (Q2)

- **No new plan machinery.** Plans already store their limits in `plans.limits` (jsonb, edited in /admin, -1 for
  unlimited, presets in `lib/payments/plan-limits.ts`). Add one numeric key, `maxWidgetsPerSpace`, next to
  `maxSpaces` and `maxTestimonialsPerSpace`. The admin form, serialisation and "Unlimited" labels already work
  for numeric keys, so there is nothing new to build or learn.
- **Suggested presets** (admins can change them at any time): free 1, pro 3, agency and business unlimited.
  Free gets one so the core product (one floating widget) is complete; a second widget (usually an inline wall)
  is the natural reason to upgrade.
- **Enforced only when creating a widget.** The Create button shows "2 of 3 widgets" next to it and, at the
  limit, becomes an upgrade prompt (the existing `upgrade-prompt-modal`). Nowhere else mentions limits.
- **A downgrade never breaks a live site.** Existing widgets keep running and stay editable; only creating new
  ones is blocked until the owner is under the limit. No forced deletes, no widgets switched off.
- **Duplicating counts as creating**, deleting frees a slot. That is the whole rule set.

## 5. Deliberately left out

- **Free-form custom CSS** per widget: support burden, breaks with every widget change, and a way to inject content
  into customer sites. The style model covers the real needs.
- **Drag-and-drop page builder** for widgets: far larger than the requests and duplicates what layouts and shapes give.
- **Per-widget fonts**: fonts stay with the brand kit to keep one source of truth.
- **User-saved style presets**: wait for demand; copy style (E1) covers most of it.
- **New frameworks in the widget** (Preact, Lit): the Shadow DOM vanilla approach and the size budget stay.
- **Dashboard widgets the user can rearrange**: a fixed, well-chosen home page is enough for now.

---

## 6. Rough total

| Phase | Size |
|---|---|
| A. Foundations | M + M + M (about 2 weeks) |
| B. Dashboard | M (can run alongside A) |
| C. Editor | L + S (about 1.5 weeks) |
| D. Widgets | M + L + L (about 3 weeks, layouts can ship one at a time) |
| E. Opportunities | 4 S + 1 M, pick by value |
