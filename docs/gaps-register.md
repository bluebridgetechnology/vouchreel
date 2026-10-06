# Gaps register

Every gap found while doing `docs/plan-2026-10-05-remaining-work.md` that was left open, with where it
came from, what closing it means, and its state. A gap is only marked **Closed** when there is a test,
a check or a run that shows it, and the evidence is named. Anything that cannot be closed from this
environment says what is needed instead of being marked done.

Classes: **Fix** (code or tests I can change and prove here), **CI** (proved by the GitHub Actions run),
**Decision** (needs a product or legal choice from you first), **External** (needs something outside this
repo: network access, an account, real data), **Feature** (a separate piece of work from the old backlog).

## A. Stored files that outlive what they belong to

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| F1 | Owner deleting a finished AI or review video left the public file in storage | Fix | Closed (2026-10-06, commit 85c9625) |
| F2 | Files of videos deleted before F1 are still in storage and cannot be found from the database | Fix | Closed. `lib/storage/orphans.ts` and `npm run storage:prune` (report by default, `--delete` to remove, 24 h grace) compare the bucket listing with every URL in the database. Proved against a real S3-protocol server (moto) in `s3.integration.test.ts`. Not yet run against your production bucket: run it once with no flags and read the report first. |
| F3 | Deleting a social export leaves its file | Fix | Closed. There was no way to delete a social export at all. Added `DELETE /api/spaces/:id/social-exports/:exportId` and a Delete button; refused while it is still being made. `export-delete.integration.test.ts`. |
| F4 | Deleting a testimonial leaves its video, thumbnail and clip files, and its social exports' and generated videos' files | Fix | Closed for hard deletes (the public API's testimonial delete queues the testimonial's, its exports' and its AI videos' files). The dashboard's own delete is a soft delete: see D1. |
| F5 | Deleting a space leaves every file of that space | Fix | Closed. `deleteSpace` queues every file in the same transaction that deletes the rows. `cleanup.integration.test.ts`, and the space route test. |
| F6 | Deleting a collection form or a submission leaves the raw upload and the transcoded files | Fix | Closed. `deleteCollectionForm` does the same for a form's submissions' files. |
| F7 | A video upload is replaced by its transcoded copy; the raw upload file is never deleted | Fix | Closed. After a transcode the raw upload is queued for deletion. Proved with a real FFmpeg transcode in `transcode.integration.test.ts`. |
| F8 | Real S3-protocol storage was only exercised against a hand-written fake | Fix | Closed. `s3.integration.test.ts` runs the real adapter against moto: upload, public URL, delete then 404, delete of a missing file, listing past 1,000 files, and the orphan finder. CI starts moto too. |
| D1 | The dashboard's "delete testimonial" only hides it (a soft delete by design): its video and thumbnail stay in storage, publicly reachable, and so do its social exports and AI videos | Decision | Open |
| F9 | Bunny storage delete and list were never run | External | Open (needs a Bunny account) |

## B. Consent and moderation

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| C1 | No customer-facing way to withdraw consent for an AI video, so "consent withdrawn" can only be set in the database | Fix | Closed. The customer gets an email on approval with a signed link to `/consent/withdraw`; confirming removes their videos (files deleted at once, with a queued job as a safety net), stops unfinished ones, tells the owner, and blocks new videos. The owner can also record a withdrawal from the AI video panel. Unit, integration, route and browser tests. |
| C2 | Review videos have no per-video consent, only the owner's "rights confirmed" date | Decision | Open |
| C3 | The widget does not serve generated videos, so a takedown only affects the owner's own links | Feature | Open |
| C4 | Takedown notification email path not run end to end | Fix | Closed. `video-notifications.integration.test.ts` runs the real notification service: inbox row, email to the owner with the reason, and the owner's email opt-out being respected. |
| C5 | Owner panels' "removed by our team" notice only checked through the API | Fix | Closed. A browser test signs in as the owner and checks both panels (AI video and review video) show the removed notice and reason, and uses the record-withdrawal button. |

## C. Access and billing

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| S1 | A revoked platform admin keeps access until their cached session expires (up to 5 minutes) | Fix | Closed. `isPlatformAdminFresh` reads the flag from the database for the admin guard, the admin page and the settings route, so a revoked admin loses access at once. `platform-admin-server.integration.test.ts` and a browser test ("revoking admin takes effect at once", signed in with the old cookie). |
| S2 | A real Stripe or Dodo webhook replacing a manual plan grant was never tested | Fix | Closed. `webhooks.integration.test.ts` (real Postgres; only the signature check is stubbed): an admin grants a plan by hand, a Stripe checkout event replaces it, and the admin can no longer grant over it. |
| S3 | A manual plan grant's effect on the user's limits was only read in code | Fix | Closed. Same test: `getSubscriptionLimits` returns the granted plan's limits (42 spaces), then the Stripe plan's (7). |
| S4 | Users tab: suspend a user, adjust credits, separate user detail page | Decision | Open |

## D. Admin area quality

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| A1 | A page number past the last page shows "No users match" (and equivalents) instead of the last page | Fix | Closed. A page past the end now shows the last page in Users, Audit log, Usage and Moderation (`clampedPage`, `paging.test.ts`, and real-database assertions in the four integration tests). |
| A2 | On a phone the jobs tables scroll sideways and the Retry/Cancel column starts off-screen | Fix | Closed. Found by looking at phone screenshots: the Retry/Cancel and Manage buttons, and the Take down button, were off-screen. Secondary columns now fold into the first cell below 640 px (768 px for Moderation, Plans and System). Browser tests assert the buttons sit inside a 390 px screen. |
| A3 | Owner email wraps mid-address in the Users and Moderation tables | Fix | Closed. Emails truncate on one line with the full address in the tooltip; a browser test checks no email wraps on Users, Moderation and Video & jobs. |
| A4 | Phone layouts were only checked for sideways page scroll, not looked at, for most tabs | Fix | Closed. Every tab was viewed at 390 px; fixes above. A browser test now fails if any table on any tab is wider than its card. |
| A5 | No accessibility (axe) checks | Fix | Closed. `@axe-core/playwright` runs WCAG 2 A/AA rules on all eight tabs: zero violations. It covers the default state of each tab, not open dialogs. |
| A6 | Plans & pricing and Payments tabs are only checked for rendering, never edited in a browser | Fix | Closed. Browser test edits a plan (badge, max spaces, persists after reload), creates a plan, archives it behind the confirmation, reactivates it, and switches the payment provider to Dodo and back with reloads. |
| A7 | Only Chromium is tested | CI | Closed in config, proof pending CI. The browser suite can run in Firefox and WebKit (`E2E_BROWSER`) and CI runs all three; the result is recorded below once the run is read. |
| A8 | No indexes for the Usage and Moderation queries (scans the month's rows); audit text search scans the table | Fix | Closed. Measured on 600,000 videos: usage query 80 ms to 3 ms, moderation list 46-56 ms to 0.5 ms. Migration 0026 adds the three indexes. Audit text search (`ILIKE %x%`) still scans the table; it needs a trigram index and is not worth it until the log is large. |
| A9 | Admin tests and the e2e suite are not in CI | CI | Closed. CI now runs the unit tests, the integration tests against Postgres and an S3-compatible server, the real render test, the browser suite and the Docker image (green in run 37464367356). |
| A10 | Nice-to-haves noted along the way: CSV export of audit log and usage, per-space usage, chart over time, filter audit by admin, link an audit entry to what it changed | Decision | Open |

## E. Workers

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| W1 | Never ran the real `video-worker` Docker image (apt and Chromium download are blocked from this sandbox) | CI | Closed by CI. GitHub Actions run 37464367356 (commit 90e3409): the real `video-worker` image built, rendered a frame, and as a worker reported a working Chromium and a clean stop. Also found and fixed two CI bugs. |
| W2 | Video worker id is `video-worker-<pid>`: in containers every restart reuses one row, and replicas collide | Fix | Closed. The video worker id is `video-worker-<hostname>-<pid>`, so container replicas and restarts get their own rows. Not run in a container here; the CI image job still checks the row appears. |
| W3 | The 24-hour listing and 7-day pruning of heartbeats were never run against time | Fix | Closed. `heartbeat-aging.integration.test.ts` inserts rows 20 h, 30 h, 6 d and 8 d old in Postgres: only the 24 h ones are listed, and starting a worker deletes the 8 d row and keeps the 6 d row. |
| W4 | No alert outside the admin area when a worker goes quiet | Decision | Open |
| W5 | Per-worker current job and restart controls | Decision | Open |

## F. Provider integrations (Phase 1)

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| P1 | Trustpilot totals call: which API, and the response field names, are unconfirmed | External | Open (needs the Trustpilot docs or a key) |
| P2 | Trustpilot stats parser breaks silently if the response nests differently | Fix | Closed as far as it can be without the docs. `parseTrustpilotStats` accepts the nested and the flat shape and returns null for anything else (`trustpilot-stats.test.ts`). Which shape the real API returns is still P1. |
| P3 | Google attribution says "Google Reviews" with the G icon; Places policy text says the Google Maps logo or "Google Maps" | Decision | Open |
| P4 | Google and Trustpilot terms on storing review text and on shortening it are unread | External | Open |
| P5 | Style picker swatches are CSS approximations | Decision | Open |
| P6 | Numbers on the Usage tab checked only on made-up data | External | Open (needs production data) |

## G. Old backlog (from the 2026-10-02 audit and the 2026-10-05 handover)

Separate features, not gaps in what was built this session. Listed so nothing is lost. Small defects among
them are marked Fix and are in scope here; the rest wait for your go-ahead.

| ID | Item | Class | State |
| --- | --- | --- | --- |
| B1 | Long-review trim for review videos | Feature | Open |
| B2 | Collect form uses the brand kit | Feature | Open |
| B3 | Customizable video fonts | Feature | Open |
| B4 | Remotion licence before commercial scale | Decision | Open |
| B5 | Widget bundle at 98.4% of its 15 KB budget | Decision | Open |
| B6 | Email verification and two-factor sign-in | Feature | Open |
| B7 | Direct-to-storage uploads (100 MB is buffered through a Next route today) | Feature | Open |
| B8 | Error tracking, structured logging, metrics | Feature | Open |
| B9 | Nonce-based Content Security Policy | Feature | Open |
| B10 | Stripe/Dodo webhook idempotency ledger: verify, add if missing | Fix | Closed. New `webhook_events` ledger (migration 0025) and `subscriptions.last_event_at`. A redelivered Stripe or Dodo event is acknowledged and not applied twice; an older event cannot overwrite a newer one; a handling that throws releases its claim so the retry is processed. All four proved in `webhooks.integration.test.ts`. |
| B11 | GDPR: account deletion, data export, consent records | Feature | Open |
| B12 | Translations silently fall back to a mock provider (customers can get fake translations) | Fix | Closed. In production with no DeepL or Google key, translating now fails with a clear 503 instead of saving "[ES] text" as the translation (`TRANSLATION_ALLOW_MOCK=1` opts back in). Factory test. |
| B13 | The seeded Agency plan has no yearly price | Fix | Not reproducible. The seed already has a yearly Agency plan ($990); `seed-plans.test.ts` now guards that every active paid plan has monthly and yearly. If a live database lacks it, that database was seeded before the row existed: external, check with the Plans tab. |
| B14 | Large client files to split (`experiments-view`, `analytics-dashboard`, `live-preview`) | Feature | Open |
| B15 | Notification channels: Slack, browser push, full-page inbox | Feature | Open |
| B16 | "Coming soon, AI auto-clipping" placeholder badge on testimonial cards | Fix | Closed. The badge is removed from the testimonial card. |
| B17 | Pages still using their own card and tab markup instead of `Card` / `Tabs` | Feature | Open |
