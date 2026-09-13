# Sprint 3: Testimonial CRUD

**Phase**: MVP (Phase 1)
**Estimated effort**: 3–4 days
**Dependencies**: Sprint 1 (database, auth, storage)
**Goal**: Build the full testimonial management system — spaces, testimonial CRUD with oEmbed auto-fetch, contextual matching rules, drag-and-drop reordering, and AI-clipping placeholder UI. After this sprint, a user can create a space, add testimonials by pasting a video link, configure page-matching rules, and manage their testimonials.

---

## Tasks

### Task 3.1 — Space Management

- [x] Create `apps/dashboard/app/api/spaces/route.ts` — GET (list user's spaces), POST (create space)
- [x] Create `apps/dashboard/app/api/spaces/[id]/route.ts` — GET, PUT (update), DELETE
- [x] Auto-generate a unique `embedKey` on space creation (e.g., `nanoid(12)`)
- [x] Create `apps/dashboard/app/(dashboard)/spaces/page.tsx` — list spaces with create button
- [x] Create `apps/dashboard/app/(dashboard)/spaces/new/page.tsx` — create space form (name only)
- [x] Create `apps/dashboard/app/(dashboard)/spaces/[id]/layout.tsx` — space detail layout with sub-navigation tabs (Testimonials, Widget, Analytics)
- [x] Add Zod validation for API inputs

**Expected Outcomes:**
- [x] User can create a space with a name → gets a unique `embedKey`
- [x] User can list all their spaces
- [x] User can rename a space
- [x] User can delete a space (with confirmation dialog)
- [x] Users can only see/manage their own spaces (ownership check in API)
- [x] Space detail page has tabbed navigation

---

### Task 3.2 — oEmbed Proxy Endpoint

- [x] Create `apps/dashboard/app/api/oembed/route.ts`
  - Accepts `url` query param
  - Detects platform from URL pattern:
    - YouTube: `youtube.com/watch`, `youtu.be/`
    - Vimeo: `vimeo.com/`
    - MP4: ends in `.mp4` or direct video URL
  - For YouTube: fetch `https://www.youtube.com/oembed?url=...&format=json`
  - For Vimeo: fetch `https://vimeo.com/api/oembed.json?url=...`
  - For MP4: attempt `HEAD` request, extract `Content-Length`, generate thumbnail placeholder
  - Returns normalized response:
    ```json
    {
      "platform": "youtube",
      "title": "Customer testimonial",
      "thumbnailUrl": "https://i.ytimg.com/...",
      "durationSeconds": 120,
      "embedUrl": "https://www.youtube-nocookie.com/embed/VIDEO_ID"
    }
    ```
- [x] Validate URL format before making external requests
- [x] Handle errors gracefully (invalid URL, video not found, private video)
- [x] Rate-limit the endpoint to prevent abuse

**Expected Outcomes:**
- [x] Pasting a YouTube URL returns title, thumbnail, and duration
- [x] Pasting a Vimeo URL returns title, thumbnail, and duration
- [x] Pasting an MP4 URL returns platform as `mp4` with available metadata
- [x] Invalid URLs return a clear 400 error
- [x] Private/unavailable videos return a clear error message

---

### Task 3.3 — Testimonial CRUD API

- [x] Create `apps/dashboard/app/api/spaces/[id]/testimonials/route.ts`
  - GET: list testimonials for a space (ordered by `sortOrder`)
  - POST: create testimonial
    - Accept `videoUrl`, then auto-fetch metadata via oEmbed proxy
    - Accept optional overrides: `quote`, `customerName`, `customerCompany`, `tags`, `matchRules`
    - Set `clipStatus` to `'none'` (placeholder)
    - Auto-assign `sortOrder` (max + 1)
- [x] Create `apps/dashboard/app/api/spaces/[id]/testimonials/[tid]/route.ts`
  - GET: single testimonial
  - PUT: update testimonial fields
  - DELETE: soft-delete (set `isActive` to false)
- [x] Create `apps/dashboard/app/api/spaces/[id]/testimonials/reorder/route.ts`
  - Accepts array of `{ id, sortOrder }` and bulk-updates
- [x] Zod validation on all inputs
- [x] Ownership verification on all endpoints (user must own the space)

**Expected Outcomes:**
- [x] Creating a testimonial with a YouTube URL auto-populates title, thumbnail, duration
- [x] User can update quote, customer name, company, tags, match rules
- [x] User can delete (soft-delete) a testimonial
- [x] Testimonials are returned in `sortOrder` ascending
- [x] Reorder endpoint updates sort positions correctly
- [x] Non-owners get 403 on all endpoints

---

### Task 3.4 — Testimonial Management UI

- [x] Create `apps/dashboard/app/(dashboard)/spaces/[id]/testimonials/page.tsx`
  - List testimonials as cards showing: thumbnail, title, customer name, tags, status
  - "Add testimonial" button → opens add modal/drawer
  - Each card has edit/delete actions
- [x] Create add testimonial modal/form:
  - URL input field → on paste/blur, call oEmbed proxy → show preview (thumbnail + title)
  - Fields: quote (textarea), customer name, customer company, tags (multi-input)
  - Submit creates the testimonial
- [x] Create edit testimonial modal/form:
  - Pre-filled with current data
  - Same fields as add, plus active/inactive toggle
- [x] Implement drag-and-drop reordering (use `@dnd-kit/core` or similar)
  - On drop, call reorder API
- [x] Delete confirmation dialog
- [x] "Coming soon — AI auto-clipping" badge on each testimonial card

**Expected Outcomes:**
- [x] User sees a list of testimonials with thumbnails and metadata
- [x] Pasting a URL in the add form shows a preview with auto-fetched metadata
- [x] User can edit all testimonial fields
- [x] User can reorder testimonials via drag-and-drop
- [x] Deleted testimonials disappear from the list
- [x] AI clipping badge is visible but non-functional (placeholder)

---

### Task 3.5 — Contextual Matching Rules UI

- [x] Add match rules editor to the add/edit testimonial form:
  - Toggle: "Show on all pages" (default on) vs. "Show on specific pages"
  - When specific pages selected:
    - URL pattern input (glob format, e.g., `/products/*`, `/pricing`)
    - Add multiple patterns
    - Product/tag matching input
  - Preview of how the rule will match
- [x] Store match rules as JSONB:
  ```json
  {
    "mode": "all" | "specific",
    "urlPatterns": ["/products/*", "/pricing"],
    "tags": ["product-x"]
  }
  ```
- [x] Validate URL patterns on submit

**Expected Outcomes:**
- [x] Default is "show on all pages"
- [x] User can switch to specific page matching
- [x] User can add multiple URL patterns
- [x] User can add tag-based matching rules
- [x] Match rules are saved to the `matchRules` JSONB field
- [x] Invalid patterns show a validation error

---

### Task 3.6 — Onboarding Flow

- [x] Create `apps/dashboard/app/(dashboard)/onboarding/page.tsx`
  - Step 1: Create your first space (name input)
  - Step 2: Add your first testimonial (URL paste)
  - Step 3: Copy your embed snippet (show `<script>` tag)
  - Skip button on each step
- [x] After signup, redirect to onboarding if user has no spaces
- [x] After onboarding, redirect to the space's testimonial page

**Expected Outcomes:**
- [x] New users are redirected to onboarding after signup
- [x] Completing onboarding creates a space and testimonial
- [x] User sees their embed snippet at the end
- [x] Existing users (with spaces) skip onboarding and go to dashboard

---

## Sprint 3 — Verification Checklist

- [x] Can create a space and see it in the spaces list
- [x] Can add a testimonial by pasting a YouTube URL → metadata auto-populated
- [x] Can add a testimonial by pasting a Vimeo URL → metadata auto-populated
- [x] Can edit testimonial quote, name, tags, match rules
- [x] Can reorder testimonials via drag-and-drop
- [x] Can delete a testimonial (soft-delete)
- [x] Match rules UI allows "all pages" or specific URL patterns
- [x] Onboarding flow works for new users
- [x] AI clipping "Coming soon" badge is visible
- [x] API returns 403 when accessing another user's space
- [x] `turbo build` passes
- [x] `turbo test` passes
