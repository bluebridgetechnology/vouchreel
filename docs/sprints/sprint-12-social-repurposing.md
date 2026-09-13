# Sprint 12: Social Repurposing

**Phase**: Phase 2
**Estimated effort**: 4–5 days
**Dependencies**: Sprint 9 (AI clipping pipeline, FFmpeg infrastructure)
**Goal**: One-click export of testimonial clips as vertical 9:16 videos for TikTok, Instagram Reels, and YouTube Shorts. Each export carries a small Vouchreel watermark for organic growth. After this sprint, owners can download social-ready clips from their dashboard.

---

## Tasks

### Task 12.1 — Social Export Configuration

- [ ] Add export settings to dashboard: customer branding (logo upload, brand color), watermark position
- [ ] Add `socialExports` table: `id`, `testimonialId` FK, `format` (enum: tiktok/reels/shorts), `outputUrl`, `status`, `createdAt`
- [ ] Run migration

**Expected Outcomes:**
- [ ] Export settings are configurable per space
- [ ] Export records are tracked in the database

---

### Task 12.2 — FFmpeg Rendering Pipeline

- [ ] Build rendering pipeline (reuse FFmpeg infra from Sprint 9):
  - Input: testimonial video (original or clipped version)
  - Reformat to 9:16 vertical aspect ratio (letterbox, crop, or smart crop)
  - Burn in captions/subtitles
  - Overlay customer branding (logo, name)
  - Add Vouchreel watermark (small, corner, semi-transparent)
  - Output as H.264 MP4 optimized for social platforms
- [ ] Handle different input aspect ratios gracefully
- [ ] Output multiple format presets (TikTok, Reels, Shorts — may differ in max duration/resolution)

**Expected Outcomes:**
- [ ] 16:9 horizontal video → 9:16 vertical with proper framing
- [ ] Captions are burned in and readable
- [ ] Branding overlay is applied
- [ ] Vouchreel watermark is present but non-intrusive
- [ ] Output meets platform specs (resolution, codec, duration)

---

### Task 12.3 — Export UI in Dashboard

- [ ] Add "Export for social" button on testimonial cards
- [ ] Export modal:
  - Select platform (TikTok / Reels / Shorts)
  - Preview the output (or show processing status)
  - Download button when ready
  - Copy share link
- [ ] Export history with download links

**Expected Outcomes:**
- [ ] User can trigger social export from any testimonial
- [ ] Processing status is visible
- [ ] Completed exports can be downloaded
- [ ] Export history is maintained

---

### Task 12.4 — Watermark & Growth Loop

- [ ] Vouchreel watermark includes a short URL or QR code linking to `vouchreel.com`
- [ ] Watermark is configurable on premium plans (can be removed on higher tiers)
- [ ] Track watermark impressions (optional, if trackable via short URL)

**Expected Outcomes:**
- [ ] Free/basic plan exports include Vouchreel watermark
- [ ] Premium plan can remove watermark
- [ ] Watermark links to Vouchreel for organic discovery

---

## Sprint 12 — Verification Checklist

- [ ] Social export produces a 9:16 vertical video
- [ ] Captions are burned in and readable
- [ ] Customer branding (logo/colors) is applied
- [ ] Vouchreel watermark appears on free-tier exports
- [ ] Premium users can remove watermark
- [ ] Export can be downloaded from the dashboard
- [ ] Multiple platform formats are supported
- [ ] `turbo build` passes
- [ ] `turbo test` passes
