# Vouchreel — Agent Instructions

You are an AI coding agent building **Vouchreel**, a video-testimonial widget SaaS. This document governs how you approach development across all sprints.

---

## 1. Project Context

Vouchreel lets website owners paste a YouTube/Vimeo/MP4 link and instantly get a lightweight, floating video widget that plays customer testimonials on their site. The product has two phases:

- **Phase 1 (MVP)**: Sprints 1–7. Core product: paste-a-link ingestion, floating widget, contextual matching, analytics, payments.
- **Phase 2 (Post-MVP)**: Sprints 8–14. Growth features: native collection, AI clipping, reviews import, platform integrations, agency tier.

**Do not begin Phase 2 until Phase 1 is fully complete and verified.**

---

## 2. Key Reference Files

Always consult these files before starting any sprint:

| File | Purpose |
|---|---|
| `docs/implementation-plan.md` | Full technical plan — architecture, data model, tech stack, decisions |
| `docs/sprints/sprint-XX-*.md` | Individual sprint breakdown with tasks and checklists |
| `video-testimonial-widget-mvp-spec.md` | Product spec for MVP (Phase 1) |
| `video-testimonial-widget-phase2-spec.md` | Product spec for Phase 2 |
| This file (`docs/agent.md`) | Your operating instructions |

---

## 3. Technology Stack (Do Not Deviate)

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL + Drizzle ORM |
| Auth | BetterAuth |
| Payments | Stripe + Dodo Payments (admin-switchable) |
| Embed widget | Vanilla JS + Shadow DOM (no framework) |
| Storage | Pluggable adapter (S3 / R2 / Bunny.net) |
| Monorepo | Turborepo |
| Hosting | Flexible — Dockerfile for VPS, Vercel-compatible config |

**Do not introduce new frameworks, ORMs, or auth libraries without explicit user approval.**

---

## 4. Sprint Execution Rules

### 4.1 Before Starting a Sprint

1. Read the sprint file (`docs/sprints/sprint-XX-*.md`) in full.
2. Read any referenced sections of `docs/implementation-plan.md`.
3. Review the checklist — understand every expected outcome before writing code.
4. If a task depends on a previous sprint's output, verify that output exists and works.

### 4.2 During a Sprint

1. **Work task-by-task** in the order listed in the sprint file.
2. **Mark progress**: Update the sprint file's checklist as you go:
   - `[ ]` → not started
   - `[/]` → in progress
   - `[x]` → completed and verified
3. **Write tests alongside code**, not after. Each task's "Expected Outcomes" section defines what to verify.
4. **Commit logically**: Each task or logical group of tasks should be a coherent unit.
5. **Do not skip tasks** unless explicitly told to by the user.
6. **Do not gold-plate**: Build exactly what the sprint specifies. Improvements go in later sprints.

### 4.3 After Completing a Sprint

1. Run the sprint's verification checklist (bottom of each sprint file).
2. Ensure `turbo build` passes with no errors.
3. Run all tests (`turbo test`).
4. Summarize what was completed and any deviations to the user.
5. **Do not start the next sprint** until the user confirms the current one is accepted.

---

## 5. Code Standards

### 5.1 Project Structure

Follow the monorepo structure defined in the implementation plan:

```
vouchreel/
├── apps/dashboard/          # Next.js app
│   ├── app/                 # App Router routes
│   ├── lib/                 # Business logic, DB, auth, payments, storage
│   └── components/          # UI components
├── packages/widget/         # Vanilla JS embed widget
├── drizzle/                 # DB migrations
├── docs/                    # Plans, sprints, agent instructions
├── docker-compose.yml
├── turbo.json
└── package.json
```

### 5.2 Naming Conventions

- **Files & folders**: kebab-case (`widget-config.ts`, `embed-snippet/`)
- **TypeScript**: PascalCase for types/interfaces/classes, camelCase for variables/functions
- **Database columns**: snake_case in SQL, camelCase in Drizzle schema (Drizzle handles mapping)
- **API routes**: kebab-case paths (`/api/widget/[embedKey]`)
- **Environment variables**: SCREAMING_SNAKE_CASE (`DATABASE_URL`, `STORAGE_PROVIDER`)

### 5.3 TypeScript Rules

- Strict mode enabled
- No `any` types — use proper typing or `unknown` with type guards
- Export types from a central `types/` directory or co-located with their module
- Use Zod for runtime validation of API inputs

### 5.4 Error Handling

- API routes: return structured JSON errors with appropriate HTTP status codes
- Client-side: use error boundaries and toast notifications
- Widget: fail silently — never break the host site. Log errors to console in development only.

### 5.5 Environment Variables

- All env vars documented in `.env.example` with descriptions
- Never hardcode secrets or API keys
- Use `NEXT_PUBLIC_` prefix only for values that must be in the browser bundle

---

## 6. Sprint Dependency Map

```
Sprint 1: Foundation
    ↓
Sprint 2: Payments ←──────────────────┐
    ↓                                  │
Sprint 3: Testimonial CRUD            │ (all depend on Sprint 1)
    ↓                                  │
Sprint 4: Widget Customization         │
    ↓                                  │
Sprint 5: Embed Widget ───────────────→│ (depends on Sprint 3 + 4)
    ↓                                  │
Sprint 6: Analytics ──────────────────→│ (depends on Sprint 5)
    ↓
Sprint 7: Polish & Launch
    ↓
═══════════════════════════════════════
    ↓  PHASE 2 (only after MVP validated)
Sprint 8: Native Collection
    ↓
Sprint 9: AI Auto-Clipping ──────────→ (depends on Sprint 8)
    ↓
Sprint 10: Reviews Import
    ↓
Sprint 11: Platform Integrations
    ↓
Sprint 12: Social Repurposing ────────→ (depends on Sprint 9)
    ↓
Sprint 13: Advanced Analytics
    ↓
Sprint 14: Team & Agency
```

---

## 7. AI Auto-Clipping Placeholder Rules

The AI auto-clipping feature is **deferred to Phase 2** but its schema and stubs exist in MVP. During MVP sprints:

- **DO** include `clipStatus`, `clipUrl`, `transcriptUrl` fields in the testimonials schema
- **DO** show a "Coming soon — AI auto-clipping" badge in the testimonial card UI
- **DO NOT** build any transcription, LLM, or FFmpeg pipeline
- **DO NOT** add any AI/ML dependencies to `package.json`

---

## 8. Payment Provider Rules

Both Stripe and Dodo Payments must work behind the same `PaymentProvider` interface:

- Admin setting in DB controls which is active
- Both webhook endpoints must always be registered (only the active one processes events)
- Test mode / sandbox must be supported for both
- Never expose secret keys to the client

---

## 9. Widget Development Rules

The embed widget (`packages/widget/`) has unique constraints:

- **No framework dependencies** — vanilla JS only
- **Shadow DOM** — all rendering inside a shadow root to avoid CSS collisions
- **Bundle size** — must be <15 KB gzipped. Check with every build.
- **No layout shift** — widget must not cause CLS on the host page
- **Fail silently** — if the API is down or config is invalid, hide the widget. Never throw errors that break the host site.
- **Privacy first** — use `youtube-nocookie.com`, no third-party cookies, lazy-load iframes only on click

---

## 10. Testing Requirements

| Type | Tool | When |
|---|---|---|
| Unit tests | Vitest | Every utility, adapter, and business logic module |
| Integration tests | Vitest + test DB | API routes, CRUD operations, webhook handlers |
| Widget tests | Playwright or Vitest (jsdom) | Shadow DOM rendering, triggers, lazy-load behavior |
| Bundle size | esbuild + gzip-size | Widget build — assert <15 KB gzipped |
| E2E (manual) | Browser | Full flow after each sprint |

---

## 11. Deployment Compatibility

Every build must be deployable to **both** VPS and Vercel:

- `Dockerfile` + `docker-compose.yml` for VPS deployment
- `next.config` must use only Vercel-compatible features (no custom server)
- `output: 'standalone'` in Next.js config for Docker builds
- All external services (DB, storage, payments) configured via env vars — no hardcoded hosts

---

## 12. Communication Protocol

- When you encounter ambiguity in a sprint's tasks, **ask the user** before proceeding.
- When a sprint is complete, provide a **summary of what was built** and **what to verify manually**.
- If you discover a bug or design issue in a previous sprint while working on a later one, **flag it** and propose a fix — don't silently change previous work.
- If a task is significantly more complex than estimated, **inform the user** before spending excessive time.

---

## 13. UI conventions (design tokens)

All dashboard, marketing and auth UI is built from the token system in `apps/dashboard/app/globals.css` and the primitives in `apps/dashboard/components/ui`. Reference page: `/design` (dev only). `npm run lint` enforces this:

- No raw Tailwind palette classes (`bg-emerald-500`, `text-white`), no hex/`rgb()`/`hsl()` literals in TSX, no arbitrary text sizes (`text-[11px]`), no `font-semibold`/`font-bold` (Outfit max weight is 500), no legacy radius (`rounded-md/lg/xl/full`) and no shadcn alias classes (`bg-card`, `text-muted-foreground`, `bg-primary`).
- Use semantic utilities instead: `bg-surface`, `text-text-muted`, `bg-brand`, `bg-success-soft`, `rounded-card`, `rounded-pill`, `text-sm`, `font-medium`.
- Every `<button>`, `<input>`, `<select>`, `<textarea>` must use a primitive (`Button`/`buttonVariants`, `toggleStyle`, `Switch`, `Input`/`inputClass`). Modals use `Dialog` or `ModalOverlay`.
- Icons are Solar Outline via `<Icon name="..." />`; add names in `apps/dashboard/scripts/build-icons.mjs` and run `npm run icons:build -w apps/dashboard`.
- User-chosen colours (widget theme, collect-form accent, social brand colour) are data: apply with `userAccentStyle()` and `bg-(--user-accent)`. Server defaults use `DEFAULT_BRAND_HEX` from `lib/brand.ts`.
- Changing `--palette-coral-600` in `globals.css` also requires updating `DEFAULT_BRAND_HEX`, the widget's `--vr-primary` and the DB default (tests catch a mismatch). Contrast of every token pair is checked by `scripts/check-contrast.mjs`.
- Headlines are Outfit; Playfair Italic is only for one or two emphasised words (`<Em>`) on marketing/auth screens.
