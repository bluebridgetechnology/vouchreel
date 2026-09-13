# Sprint 1: Foundation

**Phase**: MVP (Phase 1)
**Estimated effort**: 3–4 days
**Dependencies**: None (first sprint)
**Goal**: Set up the monorepo, database, authentication, storage adapter, and local dev environment. After this sprint, a developer can run the project locally, sign up, log in, and see an empty dashboard.

---

## Tasks

### Task 1.1 — Monorepo Initialization

Set up the Turborepo monorepo with the Next.js dashboard app and the widget package.

- [ ] Initialize root `package.json` with `workspaces` field
- [ ] Install and configure Turborepo (`turbo.json`)
- [ ] Scaffold `apps/dashboard` with Next.js 16 (`create-next-app` with App Router, Tailwind CSS, TypeScript)
- [ ] Scaffold `packages/widget` with a basic `package.json` and esbuild config
- [ ] Create `.env.example` with all required env vars (documented with comments)
- [ ] Create `.gitignore` covering node_modules, .env, .next, dist, drizzle meta
- [ ] Verify `turbo build` succeeds across both packages
- [ ] Verify `turbo dev` starts the dashboard on `localhost:3000`

**Expected Outcomes:**
- [ ] Running `npm install` at root installs all workspace dependencies
- [ ] `turbo build` completes with no errors
- [ ] `turbo dev` starts Next.js dev server at `http://localhost:3000`
- [ ] `packages/widget` has a placeholder `index.js` that builds via esbuild

---

### Task 1.2 — Docker Compose for Local PostgreSQL

Set up a local Postgres instance for development.

- [ ] Create `docker-compose.yml` with PostgreSQL 16 service
- [ ] Configure volume for data persistence
- [ ] Set default credentials in `.env.example` (`DATABASE_URL=postgresql://...`)
- [ ] Add a `db:start` script to root `package.json`
- [ ] Verify Postgres starts and accepts connections

**Expected Outcomes:**
- [ ] `docker compose up -d` starts PostgreSQL on `localhost:5432`
- [ ] Can connect with `psql` or any DB client using the env var credentials
- [ ] Data persists across container restarts

---

### Task 1.3 — Drizzle ORM Setup & Schema

Define the full data model and generate the initial migration.

- [ ] Install `drizzle-orm` and `drizzle-kit` in `apps/dashboard`
- [ ] Install `pg` (or `postgres` / `@neondatabase/serverless`) as the PostgreSQL driver
- [ ] Create `drizzle.config.ts` pointing to the migrations directory
- [ ] Create `apps/dashboard/lib/db/schema.ts` with all tables:
  - `users` (id, email, name, avatarUrl, role, createdAt) — BetterAuth will also add its own tables
  - `spaces` (id, name, ownerId FK→users, embedKey unique, createdAt)
  - `testimonials` (id, spaceId FK, videoUrl, platform enum, thumbnailUrl, title, durationSeconds, quote, customerName, customerCompany, tags[], matchRules jsonb, sortOrder, isActive, createdAt, clipStatus enum, clipUrl nullable, transcriptUrl nullable)
  - `widgetConfigs` (id, spaceId FK unique, position enum, theme jsonb, triggerType enum, triggerValue jsonb, pagesIncluded[], pagesExcluded[], autoplayPreview boolean, createdAt)
  - `events` (id, spaceId, testimonialId, sessionId, eventType enum, pageUrl, timestamp, metadata jsonb)
  - `conversionGoals` (id, spaceId FK, goalType enum, goalValue, createdAt)
  - `plans` (id, name, price, interval, features jsonb, stripeProductId nullable, dodoProductId nullable, isActive, createdAt)
  - `subscriptions` (id, userId FK, planId FK, status enum, providerCustomerId, providerSubscriptionId, currentPeriodEnd, createdAt)
  - `adminSettings` (key text PK, value jsonb) — for payment provider toggle, etc.
- [ ] Create `apps/dashboard/lib/db/index.ts` — Drizzle client singleton with connection pooling
- [ ] Run `drizzle-kit generate` to create the initial migration SQL
- [ ] Run `drizzle-kit migrate` to apply the migration to local Postgres
- [ ] Add `db:generate`, `db:migrate`, `db:studio` scripts

**Expected Outcomes:**
- [ ] `drizzle-kit generate` produces a migration file in `drizzle/migrations/`
- [ ] `drizzle-kit migrate` applies migration without errors
- [ ] `drizzle-kit studio` opens and shows all tables with correct columns
- [ ] All enums (`platform`, `position`, `triggerType`, `eventType`, `goalType`, `clipStatus`, `subscriptionStatus`) are correctly defined
- [ ] Foreign key relationships are correct (spaces→users, testimonials→spaces, etc.)
- [ ] `clipStatus`, `clipUrl`, `transcriptUrl` placeholder fields exist on `testimonials`

---

### Task 1.4 — BetterAuth Configuration

Set up authentication with email/password and Google OAuth.

- [ ] Install `better-auth` in `apps/dashboard`
- [ ] Create `apps/dashboard/lib/auth/auth.ts` — BetterAuth server instance
  - PostgreSQL adapter using the Drizzle client
  - Email/password provider
  - Google OAuth provider (client ID / secret from env vars)
  - Session configuration (secure cookies, expiry)
- [ ] Create `apps/dashboard/lib/auth/auth-client.ts` — BetterAuth client for React
- [ ] Create `apps/dashboard/app/api/auth/[...all]/route.ts` — catch-all API route for BetterAuth
- [ ] Run BetterAuth's migration/setup to create its internal tables (sessions, accounts, etc.)
- [ ] Create auth middleware for protecting dashboard routes
- [ ] Create a `useSession` hook or context for accessing the current user in components

**Expected Outcomes:**
- [ ] BetterAuth tables (sessions, accounts, users, etc.) exist in the database
- [ ] `/api/auth/sign-up` endpoint accepts email + password and creates a user
- [ ] `/api/auth/sign-in` endpoint returns a valid session
- [ ] Session cookie is set after login and validated on protected routes
- [ ] Google OAuth config is stubbed (works when real credentials are provided)

---

### Task 1.5 — Auth UI Pages

Build the signup, login, and password reset pages.

- [ ] Install and initialize shadcn/ui (`npx shadcn-ui@latest init`)
- [ ] Set up shadcn/ui components: Button, Input, Label, Card, Form, Toast
- [ ] Create `apps/dashboard/app/(auth)/layout.tsx` — centered auth layout
- [ ] Create `apps/dashboard/app/(auth)/login/page.tsx`
  - Email + password form
  - Google OAuth button
  - Link to signup, forgot password
- [ ] Create `apps/dashboard/app/(auth)/signup/page.tsx`
  - Email + password + name form
  - Google OAuth button
  - Link to login
- [ ] Create `apps/dashboard/app/(auth)/forgot-password/page.tsx`
  - Email input, submit to BetterAuth reset flow
- [ ] Create `apps/dashboard/app/(dashboard)/layout.tsx` — authenticated layout with sidebar nav
  - Redirect to login if no session
  - Basic sidebar: Spaces, Settings, Logout
- [ ] Create `apps/dashboard/app/(dashboard)/page.tsx` — dashboard home (placeholder)

**Expected Outcomes:**
- [ ] `/login` renders a styled login form
- [ ] `/signup` renders a styled signup form
- [ ] `/forgot-password` renders email reset form
- [ ] Signing up creates a user and redirects to the dashboard
- [ ] Logging in sets a session and redirects to the dashboard
- [ ] Visiting `/` (dashboard) when logged out redirects to `/login`
- [ ] Dashboard layout shows sidebar with navigation items
- [ ] Logout clears session and redirects to `/login`

---

### Task 1.6 — Storage Adapter Interface

Create the pluggable storage abstraction.

- [ ] Create `apps/dashboard/lib/storage/types.ts` — `StorageAdapter` interface
  ```typescript
  interface StorageAdapter {
    upload(file: Buffer, key: string, options?: UploadOptions): Promise<string>
    delete(key: string): Promise<void>
    getSignedUrl(key: string, expiresIn?: number): Promise<string>
  }
  ```
- [ ] Create `apps/dashboard/lib/storage/s3.ts` — S3-compatible adapter (works for AWS S3 and R2)
- [ ] Create `apps/dashboard/lib/storage/bunny.ts` — Bunny.net Storage adapter
- [ ] Create `apps/dashboard/lib/storage/index.ts` — factory function that reads `STORAGE_PROVIDER` env var
- [ ] Add `STORAGE_PROVIDER`, `STORAGE_KEY`, `STORAGE_SECRET`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT` to `.env.example`
- [ ] Write unit tests for the factory function and adapter interface compliance

**Expected Outcomes:**
- [ ] Setting `STORAGE_PROVIDER=s3` returns an S3 adapter instance
- [ ] Setting `STORAGE_PROVIDER=r2` returns an S3-compatible adapter with R2 endpoint
- [ ] Setting `STORAGE_PROVIDER=bunny` returns a Bunny.net adapter instance
- [ ] Missing or invalid `STORAGE_PROVIDER` throws a clear error at startup
- [ ] Each adapter implements `upload`, `delete`, and `getSignedUrl`
- [ ] Unit tests pass for factory function

---

### Task 1.7 — Environment & Dev Tooling

Final polish on the dev environment.

- [ ] Complete `.env.example` with all vars from tasks above
- [ ] Add ESLint + Prettier config (shared at root level)
- [ ] Add `turbo.json` pipeline definitions for `build`, `dev`, `test`, `lint`, `db:generate`, `db:migrate`
- [ ] Create a root `README.md` with:
  - Project overview
  - Prerequisites (Node.js, Docker)
  - Setup instructions (clone, install, env, db, run)
  - Available scripts
- [ ] Verify full clean setup: `npm install` → `docker compose up -d` → `npm run db:migrate` → `turbo dev` works

**Expected Outcomes:**
- [ ] A new developer can clone the repo and get running with the README instructions
- [ ] `turbo build` passes
- [ ] `turbo lint` passes with no errors
- [ ] `turbo dev` starts the dashboard
- [ ] Database has all tables after migration

---

## Sprint 1 — Verification Checklist

Run through this checklist before marking the sprint complete:

- [ ] `docker compose up -d` starts PostgreSQL
- [ ] `npm run db:migrate` applies all migrations
- [ ] `turbo build` passes with no errors
- [ ] `turbo dev` starts dashboard on `http://localhost:3000`
- [ ] Can sign up with email + password → redirected to dashboard
- [ ] Can log out → redirected to login
- [ ] Can log back in with the same credentials
- [ ] Dashboard shows sidebar layout with placeholder content
- [ ] Database contains all expected tables (check via Drizzle Studio)
- [ ] `.env.example` documents every required environment variable
- [ ] Storage adapter factory returns correct adapter based on env var
- [ ] Widget package builds successfully (placeholder output)
