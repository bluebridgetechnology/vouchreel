# Gaps register

Every gap found while doing `docs/plan-2026-10-05-remaining-work.md` that was left open, with where it
came from, what closing it means, and its state. A gap is only marked **Closed** when there is a test,
a check or a run that shows it, and the evidence is named. Anything that cannot be closed from this
environment says what is needed instead of being marked done.

Classes: **Fix** (code or tests I can change and prove here), **CI** (proved by the GitHub Actions run),
**Decision** (needs a product or legal choice from you first), **External** (needs something outside this
repo: network access, an account, real data), **Feature** (a separate piece of work from the old backlog).

The open features (C3, B1-B3, B6-B9, B11, B14, B15, B17) are planned in `docs/plan-2026-10-07-feature-backlog.md`.

Last full check: GitHub Actions run 37480868676, commit aa7a833, all three jobs green.

## A. Stored files that outlive what they belong to

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| F1 | Owner deleting a finished AI or review video left the public file in storage | Fix | Closed (2026-10-06, commit 85c9625) |
| F2 | Files of videos deleted before F1 are still in storage and cannot be found from the database | Fix | Closed. `lib/storage/orphans.ts` and `npm run storage:prune` (report by default, `--delete` to remove, 24 h grace) compare the bucket listing with every URL in the database. Proved against a real S3-protocol server (moto) in `s3.integration.test.ts`. Not yet run against your production bucket: run it once with no flags and read the report first. |
| F3 | Deleting a social export leaves its file | Fix | Closed. There was no way to delete a social export at all. Added `DELETE /api/spaces/:id/social-exports/:exportId` and a Delete button; refused while it is still being made. `export-delete.integration.test.ts`. |
| F4 | Deleting a testimonial leaves its video, thumbnail and clip files, and its social exports' and generated videos' files | Fix | Closed for hard deletes (the public API's testimonial delete queues the testimonial's, its exports' and its AI videos' files). The dashboard's delete is now a hard delete too (D1). |
| F5 | Deleting a space leaves every file of that space | Fix | Closed. `deleteSpace` queues every file in the same transaction that deletes the rows. `cleanup.integration.test.ts`, and the space route test. |
| F6 | Deleting a collection form or a submission leaves the raw upload and the transcoded files | Fix | Closed. `deleteCollectionForm` does the same for a form's submissions' files. |
| F7 | A video upload is replaced by its transcoded copy; the raw upload file is never deleted | Fix | Closed. After a transcode the raw upload is queued for deletion. Proved with a real FFmpeg transcode in `transcode.integration.test.ts`. |
| F8 | Real S3-protocol storage was only exercised against a hand-written fake | Fix | Closed. `s3.integration.test.ts` runs the real adapter against moto: upload, public URL, delete then 404, delete of a missing file, listing past 1,000 files, and the orphan finder. CI starts moto too. |
| D1 | The dashboard's "delete testimonial" only hid it: it said "deleted" but just switched the testimonial off, so it came back as Inactive after a reload and its video, thumbnail, social exports and AI videos stayed in storage, publicly reachable | Fix | Closed (decided with you: Delete now means delete). The route calls the same `deleteTestimonialPermanently` as the public API, which removes the row and queues its files in one transaction; the dialog says it is permanent and points to Disable for hiding. `delete.integration.test.ts` drives the real route on Postgres (row gone, files queued, second delete 404, a stranger refused, signed out 401). Not clicked through in a browser, and an AI video render already in flight when its testimonial is deleted can still upload one file afterwards, which `storage:prune` finds. |
| F9 | Bunny storage delete and list were never run | External | Open (needs a Bunny account) |

## B. Consent and moderation

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| C1 | No customer-facing way to withdraw consent for an AI video, so "consent withdrawn" can only be set in the database | Fix | Closed. The customer gets an email on approval with a signed link to `/consent/withdraw`; confirming removes their videos (files deleted at once, with a queued job as a safety net), stops unfinished ones, tells the owner, and blocks new videos. The owner can also record a withdrawal from the AI video panel. Unit, integration, route and browser tests. |
| C2 | Review videos have no per-video consent, only the owner's "rights confirmed" date | Decision | Closed, as far as it can be (decision: record, do not pretend to ask). The people who wrote the reviews cannot be asked: the app has no way to contact them. What is now kept per video is which wording the owner agreed to (`rights_wording_version`, migration 0027), when, and who made it; the same text is shown in the dialog and in the Moderation tab, which flags older wording and videos made before it was recorded. `review-video.integration.test.ts` and `moderation.integration.test.ts`. If you want reviewer consent, it has to come from the platform (Google, Trustpilot) terms, which is P4. |
| C3 | The widget does not serve generated videos, so a takedown only affects the owner's own links | Feature | Open |
| C4 | Takedown notification email path not run end to end | Fix | Closed. `video-notifications.integration.test.ts` runs the real notification service: inbox row, email to the owner with the reason, and the owner's email opt-out being respected. |
| C5 | Owner panels' "removed by our team" notice only checked through the API | Fix | Closed. A browser test signs in as the owner and checks both panels (AI video and review video) show the removed notice and reason, and uses the record-withdrawal button. |

## C. Access and billing

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| S1 | A revoked platform admin keeps access until their cached session expires (up to 5 minutes) | Fix | Closed. `isPlatformAdminFresh` reads the flag from the database for the admin guard, the admin page and the settings route, so a revoked admin loses access at once. `platform-admin-server.integration.test.ts` and a browser test ("revoking admin takes effect at once", signed in with the old cookie). |
| S2 | A real Stripe or Dodo webhook replacing a manual plan grant was never tested | Fix | Closed. `webhooks.integration.test.ts` (real Postgres; only the signature check is stubbed): an admin grants a plan by hand, a Stripe checkout event replaces it, and the admin can no longer grant over it. |
| S3 | A manual plan grant's effect on the user's limits was only read in code | Fix | Closed. Same test: `getSubscriptionLimits` returns the granted plan's limits (42 spaces), then the Stripe plan's (7). |
| S4 | Users tab: suspend a user, adjust credits, separate user detail page | Decision | Closed. In the Users tab's Manage dialog: suspend (reason required, never yourself or another admin; the person cannot sign in, their open sessions are removed at once and `getSession` returns none, so a valid cookie stops working) and restore; adjust this month's review-video or AI-video credits up or down with a reason (`credit_adjustments`, migration 0028), which the creation checks and the Usage tab both use; all audited. Decision: no separate user page, the dialog is the detail view. Suspension blocks the dashboard and API only: their public widgets and collect pages keep working. Proved by `suspension.integration.test.ts`, `credit-adjustments.integration.test.ts`, the route tests and a browser test that suspends a real signed-in session (401), is refused at sign-in (403, "suspended"), restores, adds credits and finds all three in the audit log. |

## D. Admin area quality

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| A1 | A page number past the last page shows "No users match" (and equivalents) instead of the last page | Fix | Closed. A page past the end now shows the last page in Users, Audit log, Usage and Moderation (`clampedPage`, `paging.test.ts`, and real-database assertions in the four integration tests). |
| A2 | On a phone the jobs tables scroll sideways and the Retry/Cancel column starts off-screen | Fix | Closed. Found by looking at phone screenshots: the Retry/Cancel and Manage buttons, and the Take down button, were off-screen. Secondary columns now fold into the first cell below 640 px (768 px for Moderation, Plans and System). Browser tests assert the buttons sit inside a 390 px screen. |
| A3 | Owner email wraps mid-address in the Users and Moderation tables | Fix | Closed. Emails truncate on one line with the full address in the tooltip; a browser test checks no email wraps on Users, Moderation and Video & jobs. |
| A4 | Phone layouts were only checked for sideways page scroll, not looked at, for most tabs | Fix | Closed. Every tab was viewed at 390 px; fixes above. A browser test now fails if any table on any tab is wider than its card. |
| A5 | No accessibility (axe) checks | Fix | Closed. `@axe-core/playwright` runs WCAG 2 A/AA rules on all eight tabs: zero violations. It covers the default state of each tab, not open dialogs. |
| A6 | Plans & pricing and Payments tabs are only checked for rendering, never edited in a browser | Fix | Closed. Browser test edits a plan (badge, max spaces, persists after reload), creates a plan, archives it behind the confirmation, reactivates it, and switches the payment provider to Dodo and back with reloads. |
| A7 | Only Chromium is tested | CI | Closed. GitHub Actions run 37480868676 (commit aa7a833): the whole browser suite, 17 tests, passed in Chromium, Firefox and WebKit, together with lint, unit and integration tests (real Postgres and S3-compatible server), the real Remotion render and the Docker image. Getting there found four test problems that only the other browsers exposed (a navigation interrupted by a redirect, a WebKit renderer crash on repeated reload, the sign-in rate limit on the form, a wait on text that was always on the page); none was an app bug. |
| A8 | No indexes for the Usage and Moderation queries (scans the month's rows); audit text search scans the table | Fix | Closed. Measured on 600,000 videos: usage query 80 ms to 3 ms, moderation list 46-56 ms to 0.5 ms. Migration 0026 adds the three indexes. Audit text search (`ILIKE %x%`) still scans the table; it needs a trigram index and is not worth it until the log is large. |
| A9 | Admin tests and the e2e suite are not in CI | CI | Closed. CI now runs the unit tests, the integration tests against Postgres and an S3-compatible server, the real render test, the browser suite and the Docker image (green in run 37464367356). |
| A10 | Nice-to-haves noted along the way: CSV export of audit log and usage, per-space usage, chart over time, filter audit by admin, link an audit entry to what it changed | Decision | Open |

## E. Workers

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| W1 | Never ran the real `video-worker` Docker image (apt and Chromium download are blocked from this sandbox) | CI | Closed by CI. GitHub Actions run 37464367356 (commit 90e3409): the real `video-worker` image built, rendered a frame, and as a worker reported a working Chromium and a clean stop. Also found and fixed two CI bugs. |
| W2 | Video worker id is `video-worker-<pid>`: in containers every restart reuses one row, and replicas collide | Fix | Closed. The video worker id is `video-worker-<hostname>-<pid>`, so container replicas and restarts get their own rows. Not run in a container here; the CI image job still checks the row appears. |
| W3 | The 24-hour listing and 7-day pruning of heartbeats were never run against time | Fix | Closed. `heartbeat-aging.integration.test.ts` inserts rows 20 h, 30 h, 6 d and 8 d old in Postgres: only the 24 h ones are listed, and starting a worker deletes the 8 d row and keeps the 6 d row. |
| W4 | No alert outside the admin area when a worker goes quiet | Decision | Closed. `/api/cron/check-workers` (every 5 minutes in `vercel.json` and the production compose file) emails the platform admins when a worker kind has a problem: a critical one (video renders with no video worker, Chromium broken) at once, a warning (queue stuck with workers online, no job worker) after 15 minutes; repeats at most every 6 hours; one recovery email when it clears; suspended admins are not emailed; a failed send is retried next run (`alert-policy.test.ts`, `worker-alerts.integration.test.ts`, route test). Email only: no Slack or push. Needs `RESEND_API_KEY` to actually deliver (without it the message is logged). |
| W5 | Per-worker current job and restart controls | Decision | Closed. The System tab shows what each worker is running now and how long, and a Restart button on running workers (audited): the worker sees the request on its next heartbeat, finishes its jobs and exits. Decision: the web app cannot start processes, so this only brings a worker back where something supervises it; the production compose file uses `restart: always`. Proved by the heartbeat and worker unit tests, the real-database tests and a browser test. Not tried against a real container. |

## F. Provider integrations (Phase 1)

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| P1 | Trustpilot totals call: which API, and the response field names, are unconfirmed | External | Open (needs the Trustpilot docs or a key) |
| P2 | Trustpilot stats parser breaks silently if the response nests differently | Fix | Closed as far as it can be without the docs. `parseTrustpilotStats` accepts the nested and the flat shape and returns null for anything else (`trustpilot-stats.test.ts`). Which shape the real API returns is still P1. |
| P3 | Google attribution says "Google Reviews" with the G icon; Places policy text says the Google Maps logo or "Google Maps" | Decision | Closed as a decision, wording unconfirmed. Google reviews are now labelled "Google Maps" (text) in the widget and in videos, the form the Places API attribution rule is reported to allow when the logo does not fit. I could not open the policy page (blocked from here), so this rests on search snippets; a test pins the wording so it is not changed by accident. The "G" icon next to it is still our own drawing, not Google's logo: if the policy forbids that, remove it. Confirming either needs someone to read the page (P4). |
| P4 | Google and Trustpilot terms on storing review text and on shortening it are unread | External | Open |
| P5 | Style picker swatches are CSS approximations | Decision | Closed. The swatches use the same palette and blob positions as the renders. Measured by rendering the real frame for each style and drawing each swatch: mean colour distance along the edges is 8 to 17 out of 441 (under 4%), about what the cards overlapping the edge add by themselves. `npm run swatches:compare -w @vouchreel/video` repeats it. |
| P6 | Numbers on the Usage tab checked only on made-up data | External | Open (needs production data) |

## G. Old backlog (from the 2026-10-02 audit and the 2026-10-05 handover)

Separate features, not gaps in what was built this session. Listed so nothing is lost. Small defects among
them are marked Fix and are in scope here; the rest wait for your go-ahead.

| ID | Item | Class | State |
| --- | --- | --- | --- |
| B1 | Long-review trim for review videos | Feature | Open |
| B2 | Collect form uses the brand kit | Feature | Open |
| B3 | Customizable video fonts | Feature | Open |
| B4 | Remotion licence before commercial scale | Decision | Decision made, action is yours. Remotion is free for individuals and for-profit companies of up to 3 employees (and non-profits); a bigger company needs a paid Company License (remotion.pro/license), read from the installed licence file. `docs/licensing.md` explains it and a test fails if the licence text changes on upgrade (the licence says it changes in 5.0). Whether you need to buy it depends on your headcount, which I cannot know. |
| B5 | Widget bundle at 98.4% of its 15 KB budget | Decision | Closed as a decision: keep the 15 KB budget (it is in the spec, README and AGENT.md). The build now says how many bytes are left and warns from 95% (currently 98.4%, 249 bytes), so growth is visible before the build fails. Any widget feature has to be paid for by removing something. |
| B6 | Email verification and two-factor sign-in | Feature | Open |
| B7 | Direct-to-storage uploads (100 MB is buffered through a Next route today) | Feature | Open |
| B8 | Error tracking, structured logging, metrics | Feature | Closed (2026-10-07). `lib/log.ts` writes one scrubbed JSON line per event (text in development) and every server-side `console.*` in `app/api` and `lib` now goes through it (90 files). Error tracking through `@sentry/node` for the web app (`instrumentation.ts` `onRequestError`) and both workers, off unless `SENTRY_DSN` is set; every event passes a scrubber (emails, tokens, cookies, request bodies, customer text, source lines around stack frames; only the account id is kept). `GET /api/metrics` (Prometheus text, needs `METRICS_TOKEN`, off otherwise). Tests: scrubber and logger units, tracker with a test transport (nothing reaches the sink unscrubbed), route auth, and the metrics queries on real Postgres. Not verified: a real Sentry or GlitchTip server (the transport is a test double), the production Docker images with the new dependency (CI builds them), and the browser-side code, which is not covered (server only). Client components still use `console`. |
| B9 | Nonce-based Content Security Policy | Feature | Open |
| B10 | Stripe/Dodo webhook idempotency ledger: verify, add if missing | Fix | Closed. New `webhook_events` ledger (migration 0025) and `subscriptions.last_event_at`. A redelivered Stripe or Dodo event is acknowledged and not applied twice; an older event cannot overwrite a newer one; a handling that throws releases its claim so the retry is processed. All four proved in `webhooks.integration.test.ts`. |
| B11 | GDPR: account deletion, data export, consent records | Feature | Open |
| B12 | Translations silently fall back to a mock provider (customers can get fake translations) | Fix | Closed. In production with no DeepL or Google key, translating now fails with a clear 503 instead of saving "[ES] text" as the translation (`TRANSLATION_ALLOW_MOCK=1` opts back in). Factory test. |
| B13 | The seeded Agency plan has no yearly price | Fix | Not reproducible. The seed already has a yearly Agency plan ($990); `seed-plans.test.ts` now guards that every active paid plan has monthly and yearly. If a live database lacks it, that database was seeded before the row existed: external, check with the Plans tab. |
| B14 | Large client files to split (`experiments-view`, `analytics-dashboard`, `live-preview`) | Feature | Open |
| B15 | Notification channels: Slack, browser push, full-page inbox | Feature | Open |
| B16 | "Coming soon, AI auto-clipping" placeholder badge on testimonial cards | Fix | Closed. The badge is removed from the testimonial card. |
| B17 | Pages still using their own card and tab markup instead of `Card` / `Tabs` | Feature | Open |
