# Sprint 8: Native Testimonial Collection

**Phase**: Phase 2
**Estimated effort**: 7–10 days
**Dependencies**: MVP complete (Sprints 1–7)
**Goal**: Let owners collect testimonials directly from their customers — in-browser video recording, file upload, and text testimonials. This removes the "bring your own video" ceiling. After this sprint, owners can share a collection link and customers can record/upload testimonials that appear in the dashboard.

---

## Tasks

### Task 8.1 — Collection Form Database Schema

- [ ] Add `collectionForms` table: `id`, `spaceId` FK, `title`, `promptText`, `incentiveType` (enum: none/discount/custom), `incentiveValue`, `branding` (jsonb), `isActive`, `slug` (unique), `createdAt`
- [ ] Add `submissions` table: `id`, `formId` FK, `type` (enum: video/text), `videoUrl` (nullable), `text` (nullable), `customerName`, `customerEmail`, `status` (enum: pending/approved/rejected), `createdAt`
- [ ] Run migration

**Expected Outcomes:**
- [ ] New tables exist with correct schema
- [ ] Foreign keys and enums are correct

---

### Task 8.2 — Collection Form Builder UI

- [ ] Create `apps/dashboard/app/(dashboard)/spaces/[id]/collect/page.tsx`
  - Create / edit collection form: title, prompt text, incentive config, branding
  - Generate shareable link (`/collect/{slug}`)
  - Generate embeddable form snippet
  - List submissions with approve/reject actions
- [ ] API routes for CRUD on collection forms and submissions

**Expected Outcomes:**
- [ ] Owner can create a collection form with custom prompt
- [ ] Shareable link is generated
- [ ] Submissions are listed with approve/reject

---

### Task 8.3 — Public Collection Page (Video Recording)

- [ ] Create `apps/dashboard/app/collect/[slug]/page.tsx` — public, no auth required
  - MediaRecorder API integration for webcam recording
  - Record button, stop, preview, re-record
  - File size limits (e.g., max 100 MB / 5 minutes)
  - Upload progress indicator
  - Upload to storage adapter
  - Text testimonial fallback
  - Customer name + email fields
  - Thank you page with optional incentive display

**Expected Outcomes:**
- [ ] Customer can record video via webcam in-browser
- [ ] Customer can upload a video file
- [ ] Customer can leave a text testimonial
- [ ] Uploads go through the pluggable storage adapter
- [ ] Submission appears in owner's dashboard as "pending"

---

### Task 8.4 — Video Transcoding Pipeline

- [ ] Set up a transcoding job runner (serverless function or background job)
- [ ] On video upload: transcode to web-friendly format (H.264/MP4)
- [ ] Generate thumbnail from video
- [ ] Normalize resolution and bitrate
- [ ] Update submission record with processed video URL

**Expected Outcomes:**
- [ ] Uploaded videos are transcoded to consistent format
- [ ] Thumbnails are auto-generated
- [ ] Transcoding runs asynchronously without blocking the upload

---

### Task 8.5 — Submission Review & Approval Flow

- [ ] Submission review UI: play video, read text, approve/reject
- [ ] On approve: auto-create a testimonial in the space from the submission data
- [ ] Notify owner of new submissions (in-app notification or email)

**Expected Outcomes:**
- [ ] Approved submissions become testimonials in the space
- [ ] Rejected submissions are marked but data retained
- [ ] Owner is notified of new submissions

---

## Sprint 8 — Verification Checklist

- [ ] Collection form can be created with custom prompt and incentive
- [ ] Shareable link works and shows the collection form
- [ ] Webcam recording works in Chrome, Firefox, Safari
- [ ] File upload works with progress indicator
- [ ] Text testimonial submission works
- [ ] Submissions appear in dashboard as pending
- [ ] Approve converts submission to testimonial
- [ ] Video transcoding produces web-ready output
- [ ] Thumbnails are auto-generated
- [ ] `turbo build` passes
- [ ] `turbo test` passes
