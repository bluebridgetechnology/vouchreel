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

### Phase 2: PR #18 follow-ups
1. Regenerate `apps/dashboard/public/video-previews/*.jpg` from the palette-based templates.
2. Update `packages/video/README.md` (palette, 6 styles, `theme` prop, `/player` export).
3. Optional: swap CSS-approximated style swatches for rendered thumbnails.

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
