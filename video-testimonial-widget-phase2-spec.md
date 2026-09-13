# Vouchreel — Phase 2 Spec (Post-MVP)

## 1. When to start this phase
Don't start on a fixed timeline — start when the MVP has validated its core loop: real spaces installing the widget, a healthy play-through rate, evidence that contextual page-matching is actually being used, and at least a few paying customers. Phase 2 is about removing growth ceilings the MVP will hit, not adding features for their own sake.

## 2. Goals
- Remove the "bring your own video" ceiling — let owners collect testimonials directly instead of only linking ones that already exist.
- Broaden beyond video (text/Google/Trustpilot reviews) without diluting the video-first identity from v1.
- Add a growth loop that gets Vouchreel in front of new prospects on its own.
- Open up higher-value tiers (agency/white-label) now that the core product is proven.

## 3. Feature list, in priority order

### 3.1 Native testimonial collection (highest priority)
- A shareable link/embeddable form where a customer records a video testimonial in-browser (webcam) or uploads a file, or leaves a text testimonial.
- This is the single biggest unlock in this phase: MVP only works for owners who already have testimonials sitting on YouTube/Vimeo, which caps the addressable market. Collection removes that ceiling.
- Consider an incentive layer (e.g., trigger a discount code on submission) to boost response rates.

### 3.2 AI auto-clipping
- Carried over from the MVP backlog. Transcribe a long raw video, identify the strongest 15–30 second soundbite, auto-generate a clipped highlight with burned-in captions.
- Now doubles as post-processing for videos collected via 3.1, not just externally linked ones.

### 3.3 Reviews import (Google, Trustpilot, etc.) + curated templates
- Build strictly on official APIs (Google Places API / Business Profile API), not scraping — Google's terms explicitly prohibit scraping or building permanent copies of review content, and scraping risks the kind of API/IP bans that would break a widget live on a paying customer's site.
- Set expectations accordingly: the official API typically caps out around 5 reviews per business, so this is a supplement to video, not a full reviews-management feature.
- Ship 3–5 distinctive, well-designed templates rather than a sprawling gallery — competitors already have dozens of generic-looking options, so a small set of genuinely good ones is a differentiator, not a weakness.
- Blend text and video into the same "wall of love," using the same contextual-matching engine built in the MVP.

### 3.4 Social repurposing (growth loop)
- One-click export of a clipped testimonial as a vertical 9:16 video formatted for TikTok/Instagram/YouTube Shorts, with the customer's branding.
- Every export is effectively an ad for Vouchreel if it carries a small watermark/link — a built-in acquisition channel.
- Auto-posting via connected social accounts is a heavier scope item — fine to leave for phase 3.

### 3.5 Multi-language captions
- Detect visitor locale and auto-translate captions/subtitles rather than showing only the original language.

### 3.6 Integrations & ecosystem
- Native Shopify app, WordPress plugin, Webflow/Framer components — lowers friction versus a raw script tag for the site builders with the most users.
- Zapier/Make integration so testimonial requests can trigger off events elsewhere (e.g., "deal closed" in a CRM).
- Public API + webhooks for developers who want to build on top.

### 3.7 Advanced analytics & experimentation
- A/B testing between triggers, templates, and positions per space.
- Full funnel view: impression → play → click → conversion, segmented by testimonial and by page.
- Exportable reports agencies can hand to their own clients as proof of ROI.

### 3.8 Team & agency features
- Multi-seat accounts with roles (owner/editor/viewer).
- White-label tier (agency's branding instead of yours) as a premium offering.
- A multi-space dashboard for agencies managing several client sites at once.

## 4. Explicitly deferred to Phase 3+
- Native mobile SDKs for in-app (not just web) widgets.
- An integrations/marketplace directory.
- Automated testimonial-request drip sequences (CRM-style outreach campaigns).
- AI-generated "highlight reel" compiling multiple customers' clips into one summary video.

## 5. Technical considerations
- The collection form needs in-browser recording (MediaRecorder API), file size limits, and a hosting/transcoding pipeline — this is new infrastructure the MVP didn't need, since v1 only ever linked to externally hosted video.
- AI clipping needs a transcription + LLM pipeline; budget for per-minute processing cost at scale.
- Reviews sync needs a scheduled job respecting API rate limits, plus a caching strategy that accounts for the low review-count cap.
- Social export needs a rendering pipeline (e.g., ffmpeg-based) to reformat aspect ratios and burn in captions.

## 6. Success metrics
- Share of testimonials collected natively vs. linked externally (adoption signal for 3.1).
- Drop in time-to-first-testimonial for new signups.
- Uptake of reviews-import and which templates actually get used.
- Revenue mix shift toward agency/white-label plans.

## 7. Suggested build order
1. Native collection form — unlocks the widest new segment of customers.
2. AI auto-clipping — works on both linked and newly collected video.
3. Reviews import (official API only) + 3–5 curated templates.
4. Platform integrations (Shopify, WordPress, Webflow) to widen distribution.
5. Social repurposing export.
6. Advanced analytics / A-B testing.
7. Team, agency, and white-label tier.
