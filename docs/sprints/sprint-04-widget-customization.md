# Sprint 4: Widget Customization

**Phase**: MVP (Phase 1)
**Estimated effort**: 2–3 days
**Dependencies**: Sprint 3 (spaces, testimonials exist)
**Goal**: Build the widget customization dashboard — position picker, theme editor, trigger configuration, page targeting, live preview, and embed snippet generator. After this sprint, a user can fully configure how their widget looks and behaves, and copy the embed code.

---

## Tasks

### Task 4.1 — Widget Config API

- [x] Create `apps/dashboard/app/api/spaces/[id]/widget-config/route.ts`
  - GET: return widget config for the space (create default if none exists)
  - PUT: update widget config
- [x] Default widget config on first access:
  ```json
  {
    "position": "bottom-right",
    "theme": {
      "primaryColor": "#6366f1",
      "accentColor": "#ffffff",
      "mode": "light",
      "borderRadius": 12
    },
    "triggerType": "delay",
    "triggerValue": { "seconds": 5 },
    "pagesIncluded": ["*"],
    "pagesExcluded": [],
    "autoplayPreview": true
  }
  ```
- [x] Zod validation on PUT body
- [x] Ownership verification

**Expected Outcomes:**
- [x] GET returns a widget config (creates default if none exists)
- [x] PUT updates the config and returns the updated version
- [x] Invalid config values are rejected with clear errors
- [x] Non-owners get 403

---

### Task 4.2 — Position Picker

- [x] Create a visual position selector component:
  - Shows a mini page wireframe
  - Clickable positions: bottom-right, bottom-left, bottom-bar, story-strip
  - Selected position is highlighted
  - Description of each position on hover/select
- [x] Integrate into widget settings page

**Expected Outcomes:**
- [x] User can select from 4 widget positions visually
- [x] Selected position is saved and reflected in the preview
- [x] Default is bottom-right

---

### Task 4.3 — Theme Editor

- [x] Create theme editor component:
  - Primary color picker (hex input + color swatch)
  - Accent color picker
  - Light/Dark mode toggle
  - Border radius slider (0–24px)
- [x] Use shadcn/ui Popover + custom color picker (or a lightweight color picker library)
- [x] Live updates to the preview on every change

**Expected Outcomes:**
- [x] User can set primary and accent colors
- [x] User can toggle light/dark mode
- [x] User can adjust border radius
- [x] Changes are immediately reflected in the preview

---

### Task 4.4 — Trigger Configuration

- [x] Create trigger configuration component:
  - Dropdown to select trigger type:
    - `delay` → number input for seconds
    - `exit-intent` → no additional config needed
    - `scroll-depth` → number input for percentage (0–100)
    - `pageview-count` → number input for Nth pageview
    - `returning-visitor` → no additional config needed
  - Dynamic form that changes based on selected trigger
  - Description/tooltip explaining each trigger type
- [x] Validate trigger values (e.g., delay > 0, scroll 1–100)

**Expected Outcomes:**
- [x] User can select a trigger type from dropdown
- [x] Appropriate value inputs appear for each trigger type
- [x] Invalid values show validation errors
- [x] Trigger config is saved to the widget config

---

### Task 4.5 — Page Targeting

- [x] Create page targeting component:
  - Include patterns input: multi-value text input for URL patterns
  - Exclude patterns input: multi-value text input
  - Explanation text: "Use `*` as wildcard. Example: `/products/*` matches all product pages"
  - Default: include `*` (all pages)
- [x] Validate patterns are valid glob-like strings

**Expected Outcomes:**
- [x] User can add include patterns (e.g., `/pricing`, `/products/*`)
- [x] User can add exclude patterns (e.g., `/admin/*`)
- [x] Default includes all pages
- [x] Patterns are saved as arrays in the widget config

---

### Task 4.6 — Live Preview

- [x] Create a widget preview component that renders inside an iframe:
  - Shows the widget as it would appear on a real site
  - Respects current position, theme, and trigger settings
  - Shows a mock page background
  - Can click to expand the widget preview
- [x] Preview updates in real-time as the user changes settings
- [x] Optionally show mobile preview (toggle between desktop/mobile viewport)

**Expected Outcomes:**
- [x] Preview shows widget in the selected position
- [x] Preview uses the selected colors and theme
- [x] Preview updates instantly on setting changes
- [x] Mobile preview shows bottom-sheet layout

---

### Task 4.7 — Embed Snippet Generator

- [x] Create embed snippet component:
  - Displays the `<script>` tag with the space's `embedKey`
  - Format: `<script async src="https://{DOMAIN}/widget/{embedKey}.js"></script>`
  - Copy-to-clipboard button with success toast
  - Note: domain is configurable via `NEXT_PUBLIC_WIDGET_URL` env var
  - Instructions for common platforms (HTML, WordPress, Shopify, Webflow)
- [x] Add `NEXT_PUBLIC_WIDGET_URL` to `.env.example`

**Expected Outcomes:**
- [x] Embed snippet displays with the correct embedKey
- [x] Copy button copies to clipboard and shows confirmation
- [x] Instructions are provided for popular platforms
- [x] Widget URL is configurable via env var

---

### Task 4.8 — Widget Settings Page Assembly

- [x] Create `apps/dashboard/app/(dashboard)/spaces/[id]/widget/page.tsx`
  - Fetches current widget config
  - Two-column layout: settings on left, preview on right
  - Sections: Position, Theme, Trigger, Page Targeting
  - Save button at bottom (or auto-save with debounce)
  - Embed snippet section below settings
- [x] Show toast on successful save
- [x] Handle loading and error states

**Expected Outcomes:**
- [x] Widget settings page loads with current config
- [x] All setting changes are saveable
- [x] Save triggers API update and shows success toast
- [x] Two-column layout with live preview works on desktop
- [x] Mobile layout stacks settings and preview vertically

---

## Sprint 4 — Verification Checklist

- [x] Widget settings page loads with default config on first visit
- [x] Position picker allows selecting all 4 positions
- [x] Theme editor updates colors, mode, and border radius
- [x] Trigger dropdown shows all 5 trigger types with appropriate value inputs
- [x] Page targeting allows adding include/exclude patterns
- [x] Live preview reflects all current settings
- [x] Embed snippet shows correct `<script>` tag with space's embedKey
- [x] Copy-to-clipboard works
- [x] Settings persist after save and page reload
- [x] `turbo build` passes
- [x] `turbo test` passes
