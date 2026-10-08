# Implementation plan: the feature backlog, 2026-10-07

Covers the twelve items left open in `docs/gaps-register.md` that are features rather than defects:
C3, B1, B2, B3, B6, B7, B8, B9, B11, B14, B15, B17. Everything else in the register is closed or waits on
something outside this repository (F9, P1, P4, P6).

Facts below come from reading the code on `main` at commit `0fad2d9`. Sizes are rough (S = a day or less,
M = a few days, L = about a week or more) and are guesses, not measurements. Nothing here has been started.

## The question about B15: do we need Slack?

**No. I recommend not building a Slack connection.**

- Nothing in the repository, the handovers or the register says a customer asked for it.
- A real Slack integration is an app that has to be created, reviewed and maintained: OAuth install flow,
  storing a token per customer workspace, handling revoked tokens, rate limits and support questions about
  other people's workspaces. That is a lot to carry for something no one has asked for.
- **Outgoing webhooks already exist** (`lib/webhooks`, set up per space under Settings, six events:
  `testimonial.created/updated/deleted`, `submission.received/approved`, `conversion.tracked`). A customer who
  wants Slack can already point one at a Slack "incoming webhook" URL. It does not work today only because
  Slack wants a body shaped like `{"text": "..."}` and we send our own JSON.
- So the cheap answer is a **Slack-compatible message format on an existing webhook** (size S), with no OAuth
  app, no tokens stored, nothing to review. If real demand shows up later, a full Slack app can be planned then.
- Browser push is deferred for the same reason (service worker, VAPID keys, permission prompts, nobody asked).

What B15 becomes: **(1)** a full-page notification inbox, **(2)** an optional Slack-compatible webhook format.
Push is dropped from this plan.

## Order and why

| Phase | Items | Why here |
|---|---|---|
| A. Risk first | B8, B6, B11 | Visibility, then security, then legal exposure. B8 goes first so the riskier changes after it can be watched. |
| B. Platform | B15 (inbox, Slack format), B7, B9 | Independent of each other. B9 ships report-only first and waits a few days before enforcing. |
| C. Product | B2, B3, B1, C3 | B1 waits on a terms check, C3 waits on a widget size decision. B2 and B3 can run any time. |
| D. Housekeeping | B14, B17 | Only worth doing next to related work, or on a quiet week. |

Each item is its own change set: one branch, its own tests, a register row updated with the evidence, and CI
green on Chromium, Firefox and WebKit before it is called done (the rule we used all session: a gap is closed
only when a test or a run shows it).

---

## Phase A: risk first

### B8. Error tracking, structured logging, metrics (S–M)

**Today:** 151 `console.*` calls across `app` and `lib`; `instrumentation.ts` only warns about FFmpeg;
`/api/health` is the only probe. The admin System tab already shows worker health and queue depth.

**Plan**
1. `lib/log.ts`: a tiny JSON logger (level, message, fields, request or job id), no new dependency. Replace
   the `console.*` calls on the paths that matter first: jobs and workers, payments and webhooks, auth,
   storage, cron routes. Leave UI-only calls alone.
2. Error tracking through the Sentry SDK (`@sentry/nextjs` for the app, `@sentry/node` for `main.ts` and
   `main-video.ts`), wired through `onRequestError` in `instrumentation.ts`. **Off unless `SENTRY_DSN` is set**,
   so the self-hosted compose file and tests behave as before. A DSN also works with Sentry-compatible
   servers (GlitchTip).
3. Scrubbing before anything leaves the server: email addresses, tokens, cookies, review and testimonial text,
   consent links. A unit test feeds sample events through the scrubber.
4. Metrics: no new service. Expose queue depth, oldest queued age, failed jobs and worker count on a
   token-protected `/api/metrics` in Prometheus text format, built from the queries the System tab already runs.

**Tests:** logger output shape; scrubber; the DSN-less path does nothing; `/api/metrics` is 401 without the
token and correct with it.
**Needs from you:** hosted Sentry or self-hosted (default: SDK with an optional DSN, either works).
**Done when:** a thrown error in a route, in the job worker and in the video worker each reaches a test sink
with personal data removed.

### B6. Email verification and two-factor sign-in (M–L)

**Today:** `lib/auth/auth.ts` has email and password only. The reset email already works.

**Plan**
1. **Verification.** Turn on Better Auth's `emailVerification` (send on sign-up) and
   `requireEmailVerification`. Existing accounts would be locked out, so a migration marks accounts that
   exist at cutover as verified (stated plainly in the release note). New sign-ups must verify before they can
   sign in; the login page offers "resend". Behind an env flag so it can be turned on after the email
   provider is confirmed working (needs `RESEND_API_KEY`).
2. **Two-factor.** Better Auth's `twoFactor` plugin: authenticator-app codes plus single-use backup codes.
   Adds a `two_factor` table and `user.two_factor_enabled` (migration). Settings page to enable (QR code,
   confirm with a code, show backup codes once) and disable (needs password).
3. **Admins.** Platform admins must have it on: the Admin area redirects to the setup page until they do.
4. **Lockout recovery.** A platform admin can switch 2FA off for another user, audited, never for themselves.
   Backup codes cover the person's own lost phone.
5. Sign-in and verification keep the existing rate limits.

**Tests:** unit; integration for the cutover migration; browser test that signs up, is blocked until the link
is used, enables 2FA with a generated code (a TOTP library in the test), signs out and back in with a code and
with a backup code, and that an admin without 2FA is sent to setup.
**Risks:** lockouts (hence recovery paths and the env flag); emails not arriving. Roll out verification first,
2FA a week later.
**Needs from you:** whether 2FA is optional for ordinary users (default: optional) and required for admins
(default: required).

### B11. GDPR: account deletion, data export, consent records (M–L)

**Today:** 16 foreign keys point at `user`, 10 cascade and the rest set null. The pieces for file cleanup now
exist (`collectSpaceUrls`, `queueFileCleanup`, the durable `file_cleanup` job). Payment providers expose
`cancelSubscription`.

**Plan**
1. **Delete my account.** Settings, "Delete account": password, then a confirmation email link. In one
   transaction: cancel the Stripe or Dodo subscription, queue every owned space's files, delete the user
   (cascades), delete sessions. Refused while the person owns a space with other team members (transfer or
   remove them first) and for the last platform admin. Audit-log rows keep the action with the actor cleared.
2. **Export my data.** A `data_export` job builds a zip (JSON for spaces, testimonials, submissions,
   consents, notifications; the files by link), stores it with an expiring link and emails the link. Rate
   limited to one per day.
3. **Consent records.** The export includes `testimonial_consents` (wording version, time, source,
   withdrawal). The owner's Consent view gets a CSV download.
4. **A testimonial author's request.** The people who wrote testimonials are not account holders, so the owner
   needs a "remove everything for this email" action across submissions, testimonials, consents and generated
   videos, with files queued for deletion. This is the harder case and the one most likely to be asked for.
5. A written retention note in `docs/` (what is kept, for how long, and why: audit log, payment records
   the law requires).

**Tests:** integration (delete removes rows and queues files, refused cases, provider cancel called once);
export contents; author-removal; browser test of the delete flow with the email link.
**Needs from you / outside the repo:** legal review of the retention note and of whether deletion is
immediate or after a grace period (default: immediate after email confirmation).
**Not covered:** backups. Deleted data can persist in database backups until they roll off; the note says so.

---

## Phase B: platform

### B15. Notification inbox, and Slack through webhooks (S + S)

**Today:** the bell (`components/notifications/notification-bell.tsx`) lists recent items; there is no
full page. Channels are in-app and email only (`lib/notifications/catalog.ts`).

**Plan**
1. `/notifications` page: all notifications, unread filter, mark all read, paging, linked from "View all" in
   the bell. Uses `lib/notifications/queries.ts`.
2. Slack-compatible format: a `format` column on webhook endpoints (`json` default, `slack`). For `slack`,
   `lib/webhooks/deliver.ts` sends `{"text": "..."}` built from the event ("New testimonial from Ada in
   <space>") and keeps retries and delivery records. The Webhooks settings page gets a format choice and a
   "Send test message" button.
3. Docs: a short "send to Slack" note (create an incoming webhook in Slack, paste its URL, pick Slack format).

**Tests:** inbox paging, filtering and marking read; the Slack body for each of the six events; a test message
reaches a local receiver; the default JSON format is unchanged.
**Dropped:** a Slack OAuth app, browser push (see above).

### B7. Direct-to-storage uploads (M–L)

**Today:** `app/api/collect/[slug]/submissions/route.ts` takes up to 100 MB through the Next.js server, then
`lib/transcode.ts` reads it back.

**Plan**
1. `POST /api/collect/[slug]/uploads` returns a presigned **POST** (not PUT, because only a POST policy can
   enforce a size range) for a key under `uploads/pending/`, with type and size conditions. S3 and R2 only.
2. The form uploads straight to storage with progress, then submits the key. The server checks the object
   exists, its real size, and the first bytes (a media-type sniff, not the browser's claim) before accepting.
3. Transcoding starts from the stored object as now; the raw upload is removed afterwards by the cleanup
   already built (F7).
4. Bunny and the local adapter keep the current server route (Bunny has no presigned uploads; local is for
   development). The form picks the path from a flag in the page data.
5. Uploads never submitted are found by `npm run storage:prune` (already skips young files) and by a bucket
   lifecycle rule on `uploads/pending/` (documented, with the bucket CORS configuration).

**Tests:** presign conditions; a real upload to moto in the integration suite; oversize and wrong-type
rejected by storage and by the check; a browser test using the fake S3; submission without a matching object
refused.
**Risks:** bucket CORS is easy to get wrong on a customer's setup (document and check it at start-up).

### B9. Nonce-based Content Security Policy (M)

**Today:** `next.config.ts` sets static headers; script sources are not restricted per request.

**Plan**
1. Generate a nonce per request in the Next 16 request hook (`middleware`, called `proxy` in Next 16; check the
   installed docs for the exact file name) and set the policy header from it; pass the nonce to the layout.
2. **Report-only first**, with a `/api/csp-report` endpoint that logs violations (through B8's logger).
   Run it for at least a week, fix what it finds (analytics, the Remotion player, inline styles).
3. Then enforce. Keep the collect form's `frame-ancestors *` and the rest of the policy as they are.
4. Measure the cost: a nonce forces dynamic rendering. If the marketing pages get slower, keep them static and
   use hashes for them.

**Tests:** header present with a fresh nonce each request; no violation on a crawl of the main pages in the
browser suite; the widget iframe and collect page still load.
**Risk:** this is the item most likely to break something quietly, hence the report-only stage.

---

## Phase C: product

### B2. Collect form uses the brand kit (S–M)

**Today:** the widget already applies the kit (`applyBrandKitToTheme`, `getBrandKit` in `lib/brand-kit`);
`app/collect/[slug]/page.tsx` does not.

**Plan:** load the space's kit on the collect page; apply brand colour, logo and font mode through CSS
variables the same way the widget does; run the existing contrast check so an unreadable brand colour falls
back to a safe text colour; keep the iframe embedding behaviour.
**Tests:** snapshot of the variables for a kit; contrast fallback; a browser test of the form with a kit
(and axe on it).
**Decision:** how far fonts go (default: only the kit's existing font setting, no new fonts here; B3 widens it).

### B3. Customisable video fonts (M)

**Today:** only Outfit and Playfair Display, in `public/video-fonts`. Each template's `maxChars` in
`packages/video/src/registry.ts` (240 to 400) was tuned to Outfit.

**Plan**
1. A **curated list** of about six open-licence families (SIL OFL), not uploads: bundled files plus their
   licence texts, as is done now.
2. `brand_kits.video_font` (migration) and an override on create, like the style.
3. Fit: measure each font's average width against Outfit with a script (same approach as
   `swatches:compare`) and scale each template's character limit per font, so text that fit still fits.
4. Remotion loads the chosen font; the Docker image gets the files; the dashboard picker and the live player
   show it.
**Tests:** every font renders every template in the real-render CI job without overflow; unknown font falls
back to the default; licence files present.
**Needs from you:** the list of fonts (default: a sans, a serif, a rounded, a condensed, a mono, a handwriting
accent).

### B1. Long-review trim for review videos (M)

**Today:** a review longer than the template's limit cannot be used at all, and review text is never altered.
The design is already written in `docs/plan-2026-10-05-remaining-work.md` (Phase 4, item 0).

**Plan:** opt-in, delete-only trim modelled on `lib/ai-video/trim.ts`: propose a cut in whole sentences, in
order; show original and trimmed side by side; the owner approves and may only delete more; mark the cut with
an ellipsis in the video; store the original and the approved text on the `review_videos` row (migration);
the default stays verbatim.
**Built (2026-10-08) as an automatic cut, not an approval flow** (see the register row). **Open question:** read the Google and Trustpilot terms on shortening review text. I could not open them from
the sandbox (P4). If they forbid it, this item stops here.
**Tests:** only an ordered subset passes validation; the API rejects reworded or reordered text; the render
shows the ellipsis; untouched reviews are byte-for-byte as before.

### C3. Show generated videos in the widget (M)

**Today:** the widget gets testimonials from `GET /api/widget/[embedKey]` (cached 60 s browser, 5 min CDN) and
has 249 bytes of room under its 15 KB budget (B5).

**Plan**
1. **Size first:** put video playback in a second script, `vouchreel-widget-video.js`, loaded only when the
   page data contains videos. The core stays inside the budget; the extra file has its own, separate budget.
2. A per-video "show in widget" switch (migration), off by default.
3. The widget API includes only videos that are done, not taken down, not deleted, and, for AI videos, whose
   consent has not been withdrawn.
4. **Takedown must reach pages already loaded.** The 5-minute CDN cache can serve a removed video, so the
   widget treats a failed media request as "hide this tile", and takedown also invalidates the embed response
   (cache tag or a short cache on responses that contain videos).
5. AI videos keep their burned-in "AI-generated" label.
**Tests:** API filtering (including a withdrawn consent and a taken-down video); the widget hides a tile whose
file is gone; the core bundle stays within budget in CI; a browser test with a real embed page.
**Needs from you:** whether review videos and AI videos are both allowed in the widget (default: both).

---

## Phase D: housekeeping

### B14. Split the three large client files (S–M each)

`experiments-view.tsx` (1,078 lines), `analytics-dashboard.tsx` (1,015), `live-preview.tsx` (652). No tests
cover them, so a refactor is risky. Plan: for each, first add a browser smoke test of the screen, then extract
pure helpers and sub-components with no change in behaviour, one file per change set, smallest first
(`live-preview`). Do it next to feature work that touches the file, not as a standalone project.

### B17. Shared `Card` and `Tabs` everywhere (S–M)

41 files use the raw card classes while 17 import `Card`. Plan: mechanical conversion in batches by area,
checked by the browser suite and screenshots; then extend the existing design-token lint guard so new code
cannot reintroduce the raw markup. Same advice as B14: do it alongside related work.

---

## What I need from you before starting

| # | Question | My default if you don't say |
|---|---|---|
| 1 | B15: drop the Slack app, ship the inbox and the Slack-format webhook? | Yes |
| 2 | B8: Sentry-compatible SDK, off unless a DSN is set? | Yes |
| 3 | B6: 2FA required for platform admins, optional for others? | Yes |
| 4 | B11: immediate deletion after email confirmation; who reviews the retention note? | Immediate; legal review is yours |
| 5 | B1: someone reads the Google and Trustpilot terms before it is built | Blocked until done |
| 6 | B3: the six fonts | A sans, a serif, a rounded, a condensed, a mono, a handwriting accent |
| 7 | C3: both video kinds in the widget, second script for playback | Yes |
| 8 | Which phase to start | A, beginning with B8 |

## How each item is finished

Same as this session: code and tests in one change set; lint, type check and the full suites green locally
(the one Remotion render test only runs in CI); CI green on all three browsers; the register row updated with
the evidence and with what was **not** verified; no item called done on its own say-so.
