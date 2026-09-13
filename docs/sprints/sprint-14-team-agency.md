# Sprint 14: Team & Agency Features

**Phase**: Phase 2
**Estimated effort**: 5–7 days
**Dependencies**: Sprint 2 (payments/plans), Sprint 13 (reports for agencies)
**Goal**: Add multi-seat accounts with role-based access, white-label tier, and an agency dashboard for managing multiple client sites. After this sprint, agencies can manage multiple clients under one account with their own branding.

---

## Tasks

### Task 14.1 — Multi-Seat Accounts

- [ ] Add `teamMembers` table: `id`, `teamOwnerId` FK (user who owns the account), `userId` FK (invited user), `role` (enum: owner/editor/viewer), `invitedAt`, `acceptedAt`
- [ ] Add `teamInvites` table: `id`, `teamOwnerId` FK, `email`, `role`, `token` (unique), `expiresAt`, `createdAt`
- [ ] Run migration
- [ ] Invitation flow:
  - Owner enters email + role → sends invite email with magic link
  - Invitee clicks link → creates account (or links existing) → added as team member
- [ ] Permission enforcement:
  - `owner`: full access to everything
  - `editor`: CRUD on testimonials, widget config, collection forms; read analytics
  - `viewer`: read-only access to testimonials and analytics

**Expected Outcomes:**
- [ ] Owner can invite team members by email
- [ ] Invites are sent with secure tokens
- [ ] Accepted invites create team member associations
- [ ] `editor` cannot change billing or delete spaces
- [ ] `viewer` cannot modify any data
- [ ] Permissions are enforced at the API level

---

### Task 14.2 — Team Management UI

- [ ] Create `apps/dashboard/app/(dashboard)/settings/team/page.tsx`
  - List current team members (name, email, role, joined date)
  - Invite new member form (email + role dropdown)
  - Change role dropdown per member
  - Remove member (with confirmation)
  - Pending invites list with resend/cancel options
- [ ] Update dashboard sidebar to show team context

**Expected Outcomes:**
- [ ] Team management page lists all members and invites
- [ ] Invitations can be sent, resent, and cancelled
- [ ] Roles can be changed
- [ ] Members can be removed

---

### Task 14.3 — White-Label Tier

- [ ] Add white-label settings to space config:
  - Custom logo upload (replaces Vouchreel branding in widget)
  - Custom domain for collection forms (CNAME setup)
  - Remove "Powered by Vouchreel" from widget
  - Custom email sender for collection invites
- [ ] White-label only available on premium/agency plans (feature gate)
- [ ] Widget: check white-label settings and conditionally show/hide branding
- [ ] Collection forms: use custom logo and domain when white-labeled

**Expected Outcomes:**
- [ ] Premium users can upload custom logo
- [ ] Widget removes Vouchreel branding for white-label accounts
- [ ] Collection forms use custom branding
- [ ] Free/basic users see Vouchreel branding (not removable)

---

### Task 14.4 — Agency Dashboard

- [ ] Create `apps/dashboard/app/(dashboard)/agency/page.tsx` — multi-space overview
  - Grid/list of all spaces managed by the agency account
  - At-a-glance metrics per space: total impressions, plays, conversions
  - Quick actions: view analytics, manage testimonials, generate report
  - "Add client" button → creates a new space
- [ ] Filter and sort spaces by name, performance, or date
- [ ] Aggregate analytics across all spaces

**Expected Outcomes:**
- [ ] Agency users see all their spaces in one view
- [ ] Per-space metrics are visible at a glance
- [ ] Can navigate to any space's details quickly
- [ ] Aggregate stats across all spaces are available

---

### Task 14.5 — Plan Tiers & Feature Gating

- [ ] Update plans table with tiered features:
  - **Free**: 1 space, 3 testimonials, basic analytics, Vouchreel branding
  - **Pro**: 5 spaces, unlimited testimonials, full analytics, conversion tracking
  - **Agency**: unlimited spaces, multi-seat, white-label, exportable reports, priority support
- [ ] Implement feature gating middleware/helper:
  ```typescript
  function canAccess(user, feature): boolean
  // e.g., canAccess(user, 'white-label') → true only for Agency plan
  ```
- [ ] Show upgrade prompts when users hit plan limits
- [ ] Update pricing page with final tier details

**Expected Outcomes:**
- [ ] Feature gating enforces plan limits
- [ ] Free users are limited to 1 space and 3 testimonials
- [ ] Upgrade prompts appear when limits are reached
- [ ] Pricing page reflects final plan structure

---

## Sprint 14 — Verification Checklist

- [ ] Team invitations send correctly and can be accepted
- [ ] Role permissions are enforced (editor can't delete spaces, viewer is read-only)
- [ ] Team management UI allows invite, role change, and remove
- [ ] White-label removes Vouchreel branding for premium plans
- [ ] Custom logo appears in widget and collection forms
- [ ] Agency dashboard shows all spaces with metrics
- [ ] Feature gating enforces plan limits
- [ ] Upgrade prompts appear at plan boundaries
- [ ] `turbo build` passes
- [ ] `turbo test` passes

---

## Phase 2 Complete 🎉

At this point, Vouchreel has evolved from an MVP into a full-featured platform:

- ✅ Paste-a-link video testimonials with contextual matching
- ✅ Native testimonial collection (webcam + upload)
- ✅ AI auto-clipping with burned-in captions
- ✅ Google + Trustpilot reviews import
- ✅ 3–5 curated display templates
- ✅ Social repurposing (9:16 export)
- ✅ Platform integrations (Shopify, WordPress, Webflow, Zapier)
- ✅ Public API + Webhooks
- ✅ A/B testing + advanced analytics
- ✅ Multi-language captions
- ✅ Multi-seat teams with RBAC
- ✅ White-label / agency tier
- ✅ Exportable ROI reports

### Deferred to Phase 3+
- Native mobile SDKs
- Integrations marketplace
- Automated testimonial-request drip campaigns
- AI highlight reel (multi-customer compilation)
