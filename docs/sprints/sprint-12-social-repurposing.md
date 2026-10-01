# Sprint 12: Social Repurposing

**Phase**: Phase 2
**Estimated effort**: 4–5 days
**Dependencies**: Sprint 8 (Native collection), FFmpeg infrastructure
**Goal**: One-click export of testimonial clips as vertical 9:16 videos for TikTok, Instagram Reels, and YouTube Shorts. Each export carries a small Vouchreel watermark for organic growth. After this sprint, owners can download social-ready clips from their dashboard.

---

## Tasks

### Task 12.1 — Social Export Configuration

- [x] Add export settings to dashboard: customer branding (logo upload, brand color), watermark position
- [x] Add `socialExports` table: `id`, `testimonialId` FK, `format` (enum: tiktok/reels/shorts), `outputUrl`, `status`, `createdAt`
- [x] Run migration

**Expected Outcomes:**
- [x] Export settings are configurable per space
- [x] Export records are tracked in the database

---

### Task 12.2 — FFmpeg Rendering Pipeline

- [x] Build rendering pipeline (direct video reformatting without AI clipping bloat):
  - Input: testimonial video (original or clipped version)
  - Reformat to 9:16 vertical aspect ratio (blurred backdrop or solid letterbox)
  - Burn in captions/subtitles (quote and customer metadata)
  - Overlay customer branding (logo, name, brand color accents)
  - Add Vouchreel watermark (small, corner, semi-transparent)
  - Output as H.264 MP4 optimized for social platforms
- [x] Handle different input aspect ratios gracefully
- [x] Output multiple format presets (TikTok, Reels, Shorts — differing in max duration/resolution)

**Expected Outcomes:**
- [x] 16:9 horizontal video → 9:16 vertical with proper framing
- [x] Captions are burned in and readable
- [x] Branding overlay is applied
- [x] Vouchreel watermark is present but non-intrusive
- [x] Output meets platform specs (resolution, codec, duration)

---

### Task 12.3 — Export UI in Dashboard

- [x] Add "Export for social" button on testimonial cards
- [x] Export modal:
  - Select platform (TikTok / Reels / Shorts)
  - Preview the output (or show processing status)
  - Download button when ready
  - Copy share link
- [x] Export history with download links

**Expected Outcomes:**
- [x] User can trigger social export from any testimonial
- [x] Processing status is visible
- [x] Completed exports can be downloaded
- [x] Export history is maintained

---

### Task 12.4 — Watermark & Growth Loop

- [x] Vouchreel watermark includes a short URL or QR code linking to `vouchreel.com`
- [x] Watermark is configurable on premium plans (can be removed on higher tiers)
- [x] Track watermark impressions (optional, if trackable via short URL)

**Expected Outcomes:**
- [x] Free/basic plan exports include Vouchreel watermark
- [x] Premium plan can remove watermark
- [x] Watermark links to Vouchreel for organic discovery

---

## Sprint 12 — Verification Checklist

- [x] Social export produces a 9:16 vertical video
- [x] Captions are burned in and readable
- [x] Customer branding (logo/colors) is applied
- [x] Vouchreel watermark appears on free-tier exports
- [x] Premium users can remove watermark
- [x] Export can be downloaded from the dashboard
- [x] Multiple platform formats are supported (TikTok, Reels, Shorts)
- [x] `turbo build` passes
- [x] `turbo test` passes (216 tests passing)
