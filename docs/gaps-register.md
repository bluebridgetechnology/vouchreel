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
| F2 | Files of videos deleted before F1 are still in storage and cannot be found from the database | Fix | Open |
| F3 | Deleting a social export leaves its file | Fix | Open |
| F4 | Deleting a testimonial leaves its video, thumbnail and clip files, and its social exports' and generated videos' files | Fix | Open |
| F5 | Deleting a space leaves every file of that space | Fix | Open |
| F6 | Deleting a collection form or a submission leaves the raw upload and the transcoded files | Fix | Open |
| F7 | A video upload is replaced by its transcoded copy; the raw upload file is never deleted | Fix | Open |
| F8 | Real S3-protocol storage was only exercised against a hand-written fake | Fix | Open |
| F9 | Bunny storage delete and list were never run | External | Open (needs a Bunny account) |

## B. Consent and moderation

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| C1 | No customer-facing way to withdraw consent for an AI video, so "consent withdrawn" can only be set in the database | Fix | Open |
| C2 | Review videos have no per-video consent, only the owner's "rights confirmed" date | Decision | Open |
| C3 | The widget does not serve generated videos, so a takedown only affects the owner's own links | Feature | Open |
| C4 | Takedown notification email path not run end to end | Fix | Open |
| C5 | Owner panels' "removed by our team" notice only checked through the API | Fix | Open |

## C. Access and billing

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| S1 | A revoked platform admin keeps access until their cached session expires (up to 5 minutes) | Fix | Open |
| S2 | A real Stripe or Dodo webhook replacing a manual plan grant was never tested | Fix | Open |
| S3 | A manual plan grant's effect on the user's limits was only read in code | Fix | Open |
| S4 | Users tab: suspend a user, adjust credits, separate user detail page | Decision | Open |

## D. Admin area quality

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| A1 | A page number past the last page shows "No users match" (and equivalents) instead of the last page | Fix | Open |
| A2 | On a phone the jobs tables scroll sideways and the Retry/Cancel column starts off-screen | Fix | Open |
| A3 | Owner email wraps mid-address in the Users and Moderation tables | Fix | Open |
| A4 | Phone layouts were only checked for sideways page scroll, not looked at, for most tabs | Fix | Open |
| A5 | No accessibility (axe) checks | Fix | Open |
| A6 | Plans & pricing and Payments tabs are only checked for rendering, never edited in a browser | Fix | Open |
| A7 | Only Chromium is tested | CI | Open |
| A8 | No indexes for the Usage and Moderation queries (scans the month's rows); audit text search scans the table | Fix | Open |
| A9 | Admin tests and the e2e suite are not in CI | CI | Open |
| A10 | Nice-to-haves noted along the way: CSV export of audit log and usage, per-space usage, chart over time, filter audit by admin, link an audit entry to what it changed | Decision | Open |

## E. Workers

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| W1 | Never ran the real `video-worker` Docker image (apt and Chromium download are blocked from this sandbox) | CI | Open |
| W2 | Video worker id is `video-worker-<pid>`: in containers every restart reuses one row, and replicas collide | Fix | Open |
| W3 | The 24-hour listing and 7-day pruning of heartbeats were never run against time | Fix | Open |
| W4 | No alert outside the admin area when a worker goes quiet | Decision | Open |
| W5 | Per-worker current job and restart controls | Decision | Open |

## F. Provider integrations (Phase 1)

| ID | Gap | Class | State |
| --- | --- | --- | --- |
| P1 | Trustpilot totals call: which API, and the response field names, are unconfirmed | External | Open (needs the Trustpilot docs or a key) |
| P2 | Trustpilot stats parser breaks silently if the response nests differently | Fix | Open |
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
| B10 | Stripe/Dodo webhook idempotency ledger: verify, add if missing | Fix | Open |
| B11 | GDPR: account deletion, data export, consent records | Feature | Open |
| B12 | Translations silently fall back to a mock provider (customers can get fake translations) | Fix | Open |
| B13 | The seeded Agency plan has no yearly price | Fix | Open |
| B14 | Large client files to split (`experiments-view`, `analytics-dashboard`, `live-preview`) | Feature | Open |
| B15 | Notification channels: Slack, browser push, full-page inbox | Feature | Open |
| B16 | "Coming soon, AI auto-clipping" placeholder badge on testimonial cards | Fix | Open |
| B17 | Pages still using their own card and tab markup instead of `Card` / `Tabs` | Feature | Open |
