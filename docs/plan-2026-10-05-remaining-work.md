# Remaining work plan, 2026-10-05

Source: `docs/handover-2026-10-05.md` plus a code check of the admin area.

Note: the handover lists PRs #16 to #18 as open. `git log` on this branch shows all three already merged into `main` (latest commit `510ee6e`, "Merge pull request #18"). Treat "merge PRs" as done; confirm on GitHub.

## Admin area gap (confirmed)

The handover does not mention admin at all. An admin area does exist (Sprint 15, `/admin`), but it was built before the video features and has not been extended since.

What exists (`apps/dashboard/app/(dashboard)/admin`, `lib/admin`, `app/api/admin`):
- 5 tabs: Plans & pricing, Payments (provider switch + webhook URLs), Users (read-only list), Audit log, System (FFmpeg status only).
- Guard: `isPlatformAdmin` (page) and `requirePlatformAdminApi` (routes). Audit via `logAdminAction`.
- Plan limits already include `aiVideoCredits` and `reviewVideoCredits`, so they can be edited in the plan form.

What is missing:
1. **No visibility into the video pipeline.** The `jobs` table (queued/running/failed, `lastError`, attempts) and `review_videos` / `generated_videos` have no admin view. A stuck or failing render can only be found in the database. The System tab checks FFmpeg only, not the video worker, Remotion/Chromium, or queue depth.
2. **No job actions.** Cannot retry a failed job, cancel a stuck one, or see worker liveness.
3. **Users tab is read-only.** Cannot change a user's plan, grant/revoke platform admin (CLI only: `npm run admin:grant`), adjust credits, suspend, or open a user detail page. Both the plan-change and CLI-only-admin gaps are already listed in `handover-2026-10-02.md` item 10 and are still open.
4. **No usage/credit overview.** No per-user credit consumption for AI video or review video, so credit-limit and cost questions cannot be answered.
5. **No content moderation.** No cross-account list of review videos or generated AI videos (relevant to the FTC guardrails: consent record, AI label).
6. **Audit log coverage is narrow.** Only plan edits and provider changes are recorded; future admin actions above need to log too. No filtering or pagination (fixed 100 rows).
7. **No admin tests for the page/tabs.** Only plan-route and guard tests exist; no component or e2e coverage.
8. **Pagination.** Users list is capped at 100 with no paging.

## Plan

Phases are ordered by risk first, then admin visibility, then polish. Each phase ends with its own verification; nothing is committed or PR'd until asked.

### Phase 1: Verify what the video feature depends on (blocking for production)
1. Build the Docker `video-worker` target; run it via `docker-compose.production.yml`; update `docs/deployment.md` with what actually worked.
2. Real server-side render of aurora and dots; record render time and check the output frames. Add an integration test that renders with a `theme`.
3. Exercise the Trustpilot totals call against a real account (or document it as unverified with the exact mock boundary).
4. Check Google attribution wording and Trustpilot star rendering against each provider's published guidelines; fix the video templates if they differ.

**Phase 1 status (2026-10-05, run in a Linux sandbox)**
- Item 1 Docker build: NOT DONE. The sandbox has the docker CLI but no daemon. Must be built on a host with Docker.
- Item 2 render: DONE. Server-side `stack` 9:16 renders of aurora, dots and gradient, 26.9 s, 1080x1920 H.264 30 fps: 52 s (aurora), 67 s (dots), 52 s (gradient) with Remotion concurrency 2 on this sandbox (not representative of production hardware). File sizes 2.5 / 3.2 / 1.7 MB. A mid-video frame of aurora and dots was inspected: backgrounds, white card, Google mark and text all render correctly. Dots is about 30% slower than gradient. Only one template and one aspect were rendered.
  - Integration test added: `packages/video/src/__tests__/render.integration.test.ts`, run with `npm run test:render -w @vouchreel/video` (skipped by default; needs `REMOTION_BROWSER_EXECUTABLE` pointing at a headless shell binary and `VIDEO_CHROMIUM_NO_SANDBOX=1` as root). It passes: valid PNG per style (aurora, dots, light) and the three images differ. Default `npm test`: 63 pass, 4 skipped; `tsc` clean. Not added to CI.
- Item 3 Trustpilot totals: NOT VERIFIED. No API key, and `developers.trustpilot.com` is blocked from the sandbox. A web search suggests the business-unit endpoint returns a TrustScore and `numberOfReviews` but did not confirm the nesting. `fetchTrustpilotStats` reads `score.trustScore` and `numberOfReviews.total` and calls `api.trustpilot.com`; a search result mentioned `datasolutions.trustpilot.com` as the host. Check both against the live docs before relying on it.
- Item 4 guidelines: NOT VERIFIED against primary pages (both docs sites blocked). From search snippets only: Google's Places API policies say attribution should be the Google Maps logo, or the text "Google Maps" where space is limited, with the author's name near each review and attribution never altered. The import uses the Places API (`maps/api/place/details/json`), and the videos show the Google "G" with the text "Google Reviews". That likely differs from the policy wording, so the label text needs a decision once the policy page is read. Also check the Places terms on storing and re-displaying review content in derived videos, and that Places returns only a handful of reviews per place. Trustpilot's brand guidelines say assets and star ratings come from their business account; the rules were not read.
- No template or app code was changed for items 3 and 4.

**Phase 1 follow-up (second pass, 2026-10-05)**
- Item 1 Docker: PARTIALLY verified. The daemon could be started in the sandbox, but the network policy denies `deb.debian.org` and Chrome's download host, so the real `video-worker` target still cannot build here (its first `apt-get` step fails with 403). A scratch copy of the Dockerfile with the apt step and `remotion browser ensure` removed (plus the sandbox proxy CA added so npm could reach the registry) built successfully in about 3 minutes: `npm ci`, `worker:build` (produces `dist/video-worker.mjs`) and the Remotion bundle (`/repo/video-bundle`) all work, and the container runs as the `node` user. Starting the worker without `DATABASE_URL` exits with a DB error, as expected. NOT verified: the apt packages, the baked-in Chromium, and a render inside the container. The scratch Dockerfile was kept out of the repo.
  - To finish: build the real target on a host with open network access (`docker build --target video-worker -t vouchreel-video-worker .`), run it with a database, queue a review video, and confirm it renders. If the environment is meant to build this, add `deb.debian.org` and the Chrome download host to the environment's allowed domains.
- Item 3 Trustpilot: still NOT verified. The docs sites are blocked and search results do not show the response fields. One search result shows the newer Data Solutions API at `datasolutions.trustpilot.com/v1/business-units/{id}`, whose response includes TrustScore and review counts; our code calls the older-style `api.trustpilot.com` and reads `score.trustScore`. Decide which API the product is licensed for, then check the field names against that API's docs or a live response.
- Item 4 Google: a second search returned text from Google's Places API policies page itself: attribution should be the Google Maps logo, or the text "Google Maps" where space is limited; the author's name must be near each review; attribution must not be altered or obscured. Our videos show the Google "G" icon with the text "Google Reviews". That is a likely mismatch, but I read it from search result text, not the page. No code changed: the fix would be to change `SOURCE_LABELS.google` in `packages/video/src/types.ts` (and possibly the mark) and regenerate the thumbnails, which needs a product/legal decision first.

### Phase 2: PR #18 follow-ups
1. Regenerate `apps/dashboard/public/video-previews/*.jpg` from the palette-based templates.
2. Update `packages/video/README.md` (palette, 6 styles, `theme` prop, `/player` export).
3. Optional: swap CSS-approximated style swatches for rendered thumbnails.

**Phase 2 status (2026-10-05)**
- Item 1 thumbnails: DONE. All five `apps/dashboard/public/video-previews/*.jpg` regenerated at 360x640 from the palette-based templates (9:16, template default styles, sample text), using frames where the text has finished revealing (rating-spotlight shows its rating intro). Checked visually in a contact sheet; Minimal is now tinted, as expected. Not checked in the running dashboard picker.
- Item 2 README: DONE. `packages/video/README.md` now covers the palette rules, the six styles and per-template defaults, the `theme` prop, the `/player` export, preview flags, thumbnail regeneration steps, and both test commands.
- Item 3 style swatches: NOT DONE (optional). The picker swatches in `apps/dashboard/components/brand/video-style-picker.tsx` are still CSS approximations; the live preview is exact.

### Phase 3: Admin area (new)
1. **Video & jobs tab** (read first, then actions):
   - Queue summary by status and type, failed jobs with `lastError`, oldest queued age.
   - Recent `review_videos` / `generated_videos` with status, owner, template, cost.
   - Actions: retry failed job, cancel stuck job (via `lib/jobs/queue.ts`), each audit-logged. Route: `app/api/admin/jobs`.
2. **System tab additions:** worker heartbeat/last-seen, Chromium/Remotion availability, queue depth, DB reachability, and a build/version line.
3. **Users tab:** user detail page; change plan (writes `subscriptions`, audit-logged, with a "does not touch the payment provider" warning); grant/revoke platform admin from the UI (cannot revoke self or last admin); credit usage columns; pagination.
4. **Usage tab:** credits used vs allowance per user and totals per month for `aiVideoCredits` / `reviewVideoCredits`.
5. **Moderation:** list of generated videos with consent record and AI label state; ability to disable a video.
6. **Audit log:** add action and entity filters plus pagination; ensure every new admin write calls `logAdminAction`.
7. **Tests:** route tests for each new admin endpoint (403 for non-admin, validation, audit entry written); DB-backed query tests; add one Playwright smoke test for `/admin` access and tab rendering.

### Phase 4: Product follow-ups (decide priority with the user)
0. **Long-review trim for review videos.** Today a Google or Trustpilot review over a template's limit (240 to 400 characters, see `registry.ts`) cannot be used at all, and a review is never shortened. Add an opt-in, delete-only trim modelled on `lib/ai-video/trim.ts`:
   - Propose a trim in whole sentences, in order (reuse `proposeTrim` / `validateTrim`, adapted from words to the template's character limit); show original and trimmed side by side and require the owner to approve; the owner may edit but only by deleting text.
   - Mark trimmed text visibly in the video (for example an ellipsis where text was removed) and store the original text and the approved trim with the `review_videos` row, so the exact content shown is on record (migration needed).
   - Keep the default behaviour unchanged: untouched reviews stay verbatim, and the picker keeps saying "too long" unless the owner chooses "shorten".
   - Check the Google and Trustpilot terms on modifying review text before building this (not yet read; see Phase 1 notes); the trim must never reword, reorder or add.
   - Tests: trim validation (ordered subset, limit), API rejects non-subset edits, and a render of a trimmed review.
1. Collect form uses the brand kit.
2. Customizable video fonts (currently Outfit / Playfair Display only), with font licensing check.
3. Remotion licence: revisit before commercial scale; `acknowledgeRemotionLicense` stays unset until then.
4. Widget bundle is at 98.4% of its 15KB gz budget: any widget feature needs a budget decision or code splitting first.

### Phase 5: Carried over from the 2026-10-02 audit (not in the 10-05 handover, still open)
Email verification and 2FA; presigned direct-to-storage uploads; observability/error tracking; nonce-based CSP; webhook idempotency ledger check; GDPR deletion and export; Playwright + axe tests; DB indexes review; translations mock fallback; missing Agency yearly plan. Pick from this list after Phase 3.

### Housekeeping
- Local demo data (user and space `320621b8-ff2b-4a05-a3c6-1da2f9821b5c`), `packages/video/out/`, and the uncommitted local files listed in the handover stay untouched unless asked.

## Suggested order
Phase 1, then Phase 3 items 1-3 (so render failures from Phase 1 are visible and fixable), then Phase 2, then the rest of Phase 3, then Phases 4-5.

## Not verified
This plan is based on reading the handover, the admin source files, the schema and the plan-limits module. I did not run the app, the tests, or any render, and did not check GitHub for PR state.
