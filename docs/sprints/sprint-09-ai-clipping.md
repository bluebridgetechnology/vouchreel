# Sprint 9: AI Auto-Clipping

**Phase**: Phase 2
**Estimated effort**: 5–7 days
**Dependencies**: Sprint 8 (native collection provides video upload pipeline)
**Goal**: Activate the AI auto-clipping placeholder from MVP. Transcribe videos, identify the strongest 15–30 second soundbite, and auto-generate a clipped highlight with burned-in captions. After this sprint, owners can auto-clip long videos into short, impactful testimonial clips.

---

## Tasks

### Task 9.1 — Transcription Pipeline

- [ ] Integrate transcription API (Whisper API / Gemini / AssemblyAI)
- [ ] On trigger (user clicks "Auto-clip" or on new collection upload): send video to transcription service
- [ ] Receive timestamped transcript
- [ ] Store transcript in storage adapter and update `transcriptUrl` on the testimonial
- [ ] Update `clipStatus` to `processing`

**Expected Outcomes:**
- [ ] Video is transcribed with word-level timestamps
- [ ] Transcript is stored and linked to the testimonial
- [ ] `clipStatus` updates through the pipeline states

---

### Task 9.2 — Soundbite Selection (LLM)

- [ ] Send transcript to LLM (Gemini / GPT) with prompt:
  - "Identify the most compelling 15–30 second segment from this testimonial transcript. Return start and end timestamps."
- [ ] Parse LLM response for start/end timestamps
- [ ] Fallback: if LLM fails, allow manual trim via UI

**Expected Outcomes:**
- [ ] LLM identifies a compelling 15–30 second clip
- [ ] Start/end timestamps are extracted programmatically
- [ ] Fallback to manual selection works

---

### Task 9.3 — FFmpeg Clipping & Caption Burn-In

- [ ] Use FFmpeg (serverless or worker) to:
  - Extract the selected clip from the full video
  - Burn in captions/subtitles from the transcript
  - Output as web-optimized MP4
- [ ] Upload clipped video to storage adapter
- [ ] Update `clipUrl` and `clipStatus` to `done` on the testimonial

**Expected Outcomes:**
- [ ] Clipped video is 15–30 seconds with burned-in captions
- [ ] Output is web-optimized MP4
- [ ] `clipUrl` is populated and widget can use it

---

### Task 9.4 — Auto-Clip UI in Dashboard

- [ ] Add "Auto-clip" button on testimonial cards (replacing the "Coming soon" badge)
- [ ] Show clipping progress: `pending` → `processing` → `done` / `failed`
- [ ] Preview clipped result in-dashboard
- [ ] Manual trim/adjust UI: video player with start/end handles
- [ ] Option to re-clip with different parameters

**Expected Outcomes:**
- [ ] User can trigger auto-clipping from the dashboard
- [ ] Progress is visible in real-time
- [ ] Clipped preview is playable in the dashboard
- [ ] Manual trim is available as an alternative

---

### Task 9.5 — Widget Integration

- [ ] Update widget to prefer `clipUrl` over `videoUrl` when a clip exists
- [ ] Show the clipped version as the default preview
- [ ] Allow "Watch full video" option in expanded view

**Expected Outcomes:**
- [ ] Widget shows clipped video when available
- [ ] Users can still access the full video
- [ ] Captions display correctly in the widget

---

## Sprint 9 — Verification Checklist

- [ ] Transcription produces accurate timestamped text
- [ ] LLM selects a compelling 15–30 second segment
- [ ] FFmpeg produces a clipped video with burned-in captions
- [ ] Dashboard shows clipping progress in real-time
- [ ] Manual trim UI allows custom clip selection
- [ ] Widget uses clipped version when available
- [ ] `clipStatus` lifecycle works: none → pending → processing → done/failed
- [ ] Cost tracking: transcription + LLM costs are logged
- [ ] `turbo build` passes
- [ ] `turbo test` passes
