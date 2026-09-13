# Vouchreel — MVP Spec

## 1. One-liner
Vouchreel lets any website owner paste a YouTube or Vimeo link to a customer testimonial and instantly get a lightweight, floating video widget that plays it on their site — no filming, editing, or dev work required.

## 2. Problem
- Text/purchase-popup social proof ("Jordan just bought X") is overused and visitors tune it out.
- Video testimonials convert better than text, but collecting, hosting, and displaying them well is still a multi-tool, dev-dependent process today.
- Existing tools (Senja, Trust, Famewall, SayWall, EmbedSocial) already cover the basic "paste link → floating widget" flow, so the MVP needs at least one sharp differentiator baked in from day one, not bolted on later.

## 3. Target user (v1 assumption)
Solo founders, coaches, agencies, and small e-commerce stores who already have a handful of video testimonials sitting on YouTube/Vimeo/socials and want them live on their site today. Pick one vertical to launch Vouchreel's copy/templates around (e.g. course creators or Shopify stores) — same product, sharper positioning.

## 4. Core user flows

**A. Owner setup**
1. Sign up → create a "space" (site/project).
2. Add a testimonial: paste a YouTube, Vimeo, or MP4 URL.
3. System auto-fetches title, thumbnail, and duration via the platform's oEmbed API.
4. Owner adds: customer name/company (optional), a short quote/caption, tags (e.g. product name, page match), display order.
5. Owner customizes the widget: position (corner/bottom bar/story strip), color theme, trigger behavior, and which pages it shows on.
6. Owner copies a one-line `<script>` embed snippet into their site.

**B. Visitor experience**
1. Widget stays hidden until its trigger condition fires (see 6.3).
2. It eases into view as a small card with a thumbnail + play button (muted looping preview optional).
3. Click → expands to a larger player and plays with sound.
4. Dismiss (X) or auto-advance to the next matched testimonial.

## 5. MVP feature set (must-have)

| Feature | Notes |
|---|---|
| Paste-a-link ingestion | YouTube, Vimeo, direct MP4 at minimum |
| Auto thumbnail/title/duration fetch | Via oEmbed, not manual entry |
| Floating widget (single style) | One well-designed default, not 20 half-baked templates |
| Basic customization | Position, color, delay/trigger, pages to show on |
| One-line embed script | Async-loaded, no layout shift |
| Dashboard to manage testimonials | Add/edit/delete/reorder/tag |
| Mute-by-default autoplay preview | Required — browsers block unmuted autoplay anyway |
| Basic analytics | Impressions, plays, clicks |

## 6. Differentiators to build into v1 (not v2 afterthoughts)

### 6.1 Contextual matching
Tag each testimonial with a page/product match rule (URL pattern or product ID). The widget shows the testimonial relevant to the page the visitor is currently on, instead of rotating randomly. This is the single highest-leverage feature vs. incumbents.

### 6.2 AI auto-clipping (fast-follow, not day-1 if resourcing is tight)
Owner pastes a long raw video (e.g. a 20-minute customer call). System transcribes it, identifies the strongest 15–30 second soundbite, and auto-generates a clipped preview with burned-in captions. Manual trim as fallback.

### 6.3 Smart triggers over dumb timers
Trigger options beyond "show after N seconds": exit-intent, scroll-past-pricing-section, Nth pageview in session, returning visitor. Ship at least exit-intent and scroll-depth in v1.

### 6.4 Attribution
Track whether a session that saw/played a testimonial converted (requires a simple conversion-pixel or goal-URL setting). This is the ROI proof that justifies Vouchreel's price tag.

## 7. Technical architecture (high level)

- **Embed widget**: vanilla JS (no framework dependency) loaded async via `<script>` tag, renders into a shadow DOM to avoid CSS collisions with host sites.
- **Video handling**: don't blindly embed raw YouTube/Vimeo iframes on first paint — use youtube-nocookie.com domain, lazy-load the iframe only on click, and show a static thumbnail image until then. This avoids third-party cookie/GDPR consent issues and keeps host page speed unaffected.
- **Backend**: API for CRUD on testimonials/spaces, oEmbed fetch proxy, analytics event ingestion.
- **Dashboard**: web app for owners to manage testimonials and widget settings.
- **Data model (minimum)**:
  - `space` (id, name, owner_id, embed_key)
  - `testimonial` (id, space_id, video_url, platform, thumbnail_url, title, quote, customer_name, tags[], match_rule, sort_order)
  - `widget_config` (space_id, position, theme, trigger_type, trigger_value, pages_included, pages_excluded)
  - `event` (space_id, testimonial_id, session_id, type[impression|play|click|convert], timestamp)

## 8. Non-functional requirements
- Widget script under ~15KB gzipped; must not block page render.
- Fully responsive; mobile gets a bottom-sheet or story-bar layout, not a corner box.
- Keyboard-dismissible and screen-reader labeled (accessibility).
- No layout shift (CLS) on load.

## 9. Explicitly out of scope for v1
- Native video recording/collection forms (record-a-testimonial flow) — start with "bring your own link," add collection later once core widget has traction.
- Multi-language auto-translation of captions.
- Native social repurposing (auto-post clips to TikTok/IG) — strong v2 growth-loop feature, not MVP.
- White-label/agency reseller tier.

## 10. Success metrics for MVP
- Time from signup to first live widget on a real site (target: under 10 minutes).
- % of testimonials using contextual page-matching (proxy for whether the differentiator is actually used).
- Widget play-through rate and click-to-convert rate on sites that add the conversion pixel.

## 11. Suggested build order
1. Paste-link ingestion + oEmbed fetch + dashboard CRUD.
2. Embed script + single default widget style, lazy-loaded video.
3. Basic analytics (impressions/plays/clicks).
4. Contextual page-matching (differentiator #1).
5. Smart triggers (exit-intent, scroll-depth).
6. Conversion attribution.
7. AI auto-clipping (once core loop is validated with real users).
