# Sprint 8: Native Testimonial Collection

**Phase**: Phase 2
**Estimated effort**: 7–10 days
**Dependencies**: MVP complete (Sprints 1–7)
**Goal**: Let owners collect testimonials directly from their customers — in-browser video recording, file upload, and text testimonials. This removes the "bring your own video" ceiling. After this sprint, owners can share a collection link and customers can record/upload testimonials that appear in the dashboard.

---

## Tasks

### Task 8.1 — Collection Form Database Schema

- [x] Add `collectionForms` table: `id`, `spaceId` FK, `title`, `promptText`, `incentiveType` (enum: none/discount/custom), `incentiveValue`, `branding` (jsonb), `isActive`, `slug` (unique), `createdAt`
- [x] Add `submissions` table: `id`, `formId` FK, `type` (enum: video/text), `videoUrl` (nullable), `text` (nullable), `customerName`, `customerEmail`, `status` (enum: pending/approved/rejected), `createdAt`
- [x] Run migration

**Expected Outcomes:**
- [x] New tables exist with correct schema
- [x] Foreign keys and enums are correct

---

### Task 8.2 — Collection Form Builder UI

- [x] Create `apps/dashboard/app/(dashboard)/spaces/[id]/collect/page.tsx`
  - Create / edit collection form: title, prompt text, incentive config, branding
  - Generate shareable link (`/collect/{slug}`)
  - Generate embeddable form snippet
  - List submissions with approve/reject actions
- [x] API routes for CRUD on collection forms and submissions

**Expected Outcomes:**
- [x] Owner can create a collection form with custom prompt
- [x] Shareable link is generated
- [x] Submissions are listed with approve/reject

---

### Task 8.3 — Public Collection Page (Video Recording)

- [x] Create `apps/dashboard/app/collect/[slug]/page.tsx` — public, no auth required
  - MediaRecorder API integration for webcam recording
  - Record button, stop, preview, re-record
  - File size limits (e.g., max 100 MB / 5 minutes)
  - Upload progress indicator
  - Upload to storage adapter
  - Text testimonial fallback
  - Customer name + email fields
  - Thank you page with optional incentive display

**Expected Outcomes:**
- [/] Customer can record video via webcam in-browser
- [/] Customer can upload a video file
- [x] Customer can leave a text testimonial
- [/] Uploads go through the pluggable storage adapter
- [x] Submission appears in owner's dashboard as "pending"

---

### Task 8.4 — Video Transcoding Pipeline

- [x] Set up a transcoding job runner (serverless function or background job)
- [x] On video upload: transcode to web-friendly format (H.264/MP4)
- [x] Generate thumbnail from video
- [x] Normalize resolution and bitrate
- [x] Update submission record with processed video URL

**Expected Outcomes:**
- [/] Uploaded videos are transcoded to consistent format
- [/] Thumbnails are auto-generated
- [x] Transcoding runs asynchronously without blocking the upload

---

### Task 8.5 — Submission Review & Approval Flow

- [x] Submission review UI: play video, read text, approve/reject
- [x] On approve: auto-create a testimonial in the space from the submission data
- [x] Notify owner of new submissions (in-app notification or email)

**Expected Outcomes:**
- [x] Approved submissions become testimonials in the space
- [x] Rejected submissions are marked but data retained
- [x] Owner is notified of new submissions

---

## Sprint 8 — Verification Checklist

- [x] Collection form can be created with custom prompt and incentive
- [x] Shareable link works and shows the collection form
- [/] Webcam recording works in Chrome, Firefox, Safari
- [/] File upload works with progress indicator
- [x] Text testimonial submission works
- [x] Submissions appear in dashboard as pending
- [x] Approve converts submission to testimonial
- [/] Video transcoding produces web-ready output
- [/] Thumbnails are auto-generated
- [x] `turbo build` passes
- [x] `turbo test` passes
