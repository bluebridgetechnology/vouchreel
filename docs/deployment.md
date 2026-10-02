# Deployment Guide

VouchReel deploys as two artifacts:

1. **Dashboard app** (`apps/dashboard`) — Next.js 16 App Router, serves the dashboard, marketing pages, API routes, and the widget script.
2. **Widget bundle** (`packages/widget`) — a standalone ~15 KB script served at `/widget/<embed-key>.js`, either from the dashboard itself or from a CDN.

The database is Postgres. Migrations live in `drizzle/` at the repo root and are applied with drizzle-kit.

---

## Table of contents

- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [VPS deployment (Docker Compose)](#vps-deployment-docker-compose)
- [Vercel deployment](#vercel-deployment)
- [Widget CDN deployment](#widget-cdn-deployment)
- [Troubleshooting](#troubleshooting)

---

## Local development

Requirements: Node.js >= 20, Docker (for Postgres), and FFmpeg on your PATH for video features (`winget install Gyan.FFmpeg` / `brew install ffmpeg` / `apt install ffmpeg`; override the binary with `FFMPEG_PATH`). The server logs a warning at startup if it is missing and `/api/health` reports `degraded`.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start Postgres only (compose also defines an app service — see below)
npm run db:start          # = docker compose up -d postgres

# 4. Apply migrations and seed
npm run db:migrate

# 5. Build the widget bundle at least once (dashboard embeds it)
npm run widget:build

# 6. Start the dev servers
npm run dev
```

`npm run db:start` intentionally targets the `postgres` service by name — `docker compose up -d` alone would build and boot the full app container, which is not what you want during development.

---

## Environment variables

All variables are listed in `.env.example` (development) and `.env.production.example` (production). Summary of what matters per target:

| Variable | Build-time? | Notes |
| --- | --- | --- |
| `DATABASE_URL` | no | Runtime only. Under `docker-compose.production.yml` compose constructs it from `POSTGRES_*` — do not set it manually there. |
| `BETTER_AUTH_SECRET` | no | Required. Fresh random value per environment (`openssl rand -base64 32`). |
| `BETTER_AUTH_URL` | no | Public origin, e.g. `https://vouchreel.com`. |
| `NEXT_PUBLIC_APP_URL` | **yes** | Baked into the client bundle at build time. Must be set correctly *before* `docker build` / Vercel build. |
| `NEXT_PUBLIC_WIDGET_URL` | **yes** | Base URL used in embed snippets. Empty = serve the widget from the dashboard itself. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | no | Consumed by the `postgres` service in `docker-compose.production.yml`. `POSTGRES_PASSWORD` is required. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Optional — Google OAuth sign-in. |
| `STORAGE_*` (6 vars) | no | S3-compatible object storage for uploads. |
| `STRIPE_*` (3 vars) | no | Stripe payments + webhook secret. |
| `DODO_API_KEY` / `DODO_WEBHOOK_SECRET` | no | Dodo Payments provider + webhook secret. |

**Important:** `NEXT_PUBLIC_*` variables are inlined into the JavaScript bundle during the build. Changing them requires a rebuild — restarting the container is not enough.

---

## VPS deployment (Docker Compose)

Everything the app needs — Postgres, migrations, and the dashboard — runs from the repo root with two compose files.

### 1. Prepare the server

- Docker Engine with **Docker Compose v2.24+** (the production override uses the `!reset` YAML tag).
- Open ports 80/443 (put a reverse proxy such as Caddy, nginx, or Traefik in front for TLS) and 3000 for the app.

### 2. Configure

```bash
git clone <repo-url> && cd vouchreel
cp .env.production.example .env.production
# Edit .env.production: fill POSTGRES_PASSWORD, BETTER_AUTH_SECRET,
# BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, and any provider keys.
```

`.env.production` is read by compose via `--env-file` **and** injected into the `app` / `migrate` containers. It is excluded from the Docker build context by `.dockerignore`, so secrets never land in image layers.

### 3. Build and start

```bash
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml \
  up -d --build
```

What happens:

1. `postgres` starts and becomes healthy (healthcheck: `pg_isready`).
2. `migrate` (one-shot, build target `migrator`) applies drizzle migrations and exits.
3. `app` starts only after `migrate` reports `service_completed_successfully`.

The app image is a 4-stage build (`deps` → `builder` → `migrator`/`runner`) based on `node:24-alpine` and next.js `output: 'standalone'`. It runs as the non-root `nextjs` user on port 3000.

### 4. Verify

```bash
docker compose ps                          # migrate should be "exited (0)"
curl -I http://localhost:3000              # 200
curl -I http://localhost:3000/widget/test.js   # 200, application/javascript
```

### 5. Update a deployment

```bash
git pull
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml \
  up -d --build
```

The `migrate` service re-runs on every `up`, applying only new migrations. To revert to a previous image, rebuild from the older commit.

### Production notes

- **Do not publish the database port.** The production override resets `postgres` ports to `[]`; the DB is reachable only from the compose network.
- **Reverse proxy:** terminate TLS in front of port 3000 and forward `X-Forwarded-Proto` / `X-Forwarded-For`. Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the public HTTPS origin.
- **Backups:** back up the `pgdata` volume (e.g. `pg_dump` on a cron) — it is a named volume and survives container recreation, but not `docker compose down -v`.

---

## Vercel deployment

The dashboard deploys to Vercel as a standard Next.js app. It must be configured as a **monorepo project**.

### 1. Create the project

- Import the Git repository in Vercel.
- **Root Directory: `apps/dashboard`** — Vercel auto-detects the monorepo and installs dependencies from the repo root. If the build cannot find workspace packages, enable *"Include files outside of the Root Directory"* / set the install command to run from the repo root:
  - Install Command: `cd ../.. && npm install`
  - Build Command: `cd ../.. && npm run widget:build && npm run build --workspace=@vouchreel/dashboard`

  (Vercel's default for a Next.js app in a workspace usually works; adjust only if the build fails on the widget bundle.)

- The build runs `widget:build` first because the widget script must exist in `apps/dashboard/public/widget/` for the `/widget/[key].js` route to serve it.

### 2. Environment variables

In *Project → Settings → Environment Variables*, add every variable from `.env.example`. Minimum set to boot:

- `DATABASE_URL` — a managed Postgres (Vercel Postgres, Neon, Supabase, RDS…).
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (`https://your-app.vercel.app` or custom domain).
- `NEXT_PUBLIC_APP_URL` — same public origin.
- `NEXT_PUBLIC_WIDGET_URL` — leave empty to serve the widget from the app, or point at your CDN.
- Payment/storage provider keys as needed.
- `RESEND_API_KEY` and `EMAIL_FROM` for password-reset, invite and notification emails. Without a key emails are only logged to the server console, so password reset will not reach users.

`NEXT_PUBLIC_*` changes require a redeploy (they are inlined at build time).

### 3. Migrations

Migrations are **not** run by the Vercel build (the `db:migrate` script targets drizzle-kit, which needs the repo root). Run them from your machine or CI against the production database:

```bash
DATABASE_URL="postgres://…" npm run db:migrate
```

Run this once before the first deploy of each release that contains new migrations.

### 4. Notes

- **Video processing does not run on Vercel.** Transcoding uploads and rendering social exports need FFmpeg and long-running processes, which serverless functions cannot provide. On Vercel, text testimonials, embeds, analytics and the widget work; for video features run the VPS (Docker) deployment, or move media jobs to a separate worker. The Docker image installs FFmpeg and Noto fonts and fails the build if the `drawtext` filter is missing.
- `output: 'standalone'` in `next.config.ts` is harmless on Vercel — the platform ignores it and uses its own build output.
- Postgres must accept connections from Vercel's serverless functions (managed providers handle this; self-hosted needs TLS + IP allowlisting).

---

## Widget CDN deployment

The widget script must be reachable from every site that embeds it. Two supported options:

### Option 1 — Serve from the dashboard (default, zero setup)

The route handler at `app/widget/[key]/route.ts` serves `public/widget/vouchreel-widget.js` for **any** key:

```
https://your-domain.com/widget/<embed-key>.js
```

- CORS is `Access-Control-Allow-Origin: *`; caching is `max-age=300, s-maxage=3600`.
- Leave `NEXT_PUBLIC_WIDGET_URL` empty so embed snippets point at the dashboard itself.
- Cost: every embed pulls the script from your app server. Fine for low traffic; put a CDN in front later without changing embed snippets.

### Option 2 — Upload to a CDN (recommended at scale)

Ship `packages/widget/dist/vouchreel-widget.js` to Cloudflare, BunnyCDN, S3+CloudFront, etc.

1. Build the bundle:

   ```bash
   npm run widget:build
   # output: packages/widget/dist/vouchreel-widget.js
   ```

2. Upload it, keeping the embed-key-specific path contract intact, e.g. `https://cdn.vouchreel.com/widget/vouchreel-widget.js`.

3. Set `NEXT_PUBLIC_WIDGET_URL=https://cdn.vouchreel.com` and redeploy the dashboard so embed snippets pick up the CDN base.

4. Configure cache headers on the CDN: long TTL (e.g. 1 day) with a query-string cache buster per release (`vouchreel-widget.js?v=<version>`), or purge on deploy.

Embed snippets generated by the dashboard already prefer `NEXT_PUBLIC_WIDGET_URL` and fall back to the app origin, so switching options is a configuration change, not a code change.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `docker compose up` fails: `POSTGRES_PASSWORD must be set` | `.env.production` missing or the variable is empty. Fill it in, pass `--env-file .env.production`. |
| `!reset` parse error | Compose < v2.24. Upgrade Docker Compose. |
| App container starts but `/widget/x.js` returns the "bundle not found" stub | Widget wasn't built before the dashboard build. The Dockerfile runs `widget:build` in the `builder` stage — if customizing the build, keep that step before `next build`. |
| Embed snippet still points to the old URL | `NEXT_PUBLIC_*` is build-time. Rebuild/redeploy after changing it. |
| `migrate` exits non-zero | Check `docker compose logs migrate`; usually a bad `DATABASE_URL`/`POSTGRES_*` combination or the DB not accepting connections yet. |
| Uploaded videos stay `Processing failed` / social export says FFmpeg is not installed | FFmpeg is missing on the host (the Docker image includes it). Install it, or set `FFMPEG_PATH`, restart, and confirm `GET /api/health` shows `ffmpeg: true`. Admin → System health shows the detected version. |
| Vercel build: "workspace package not found" | Root Directory must be `apps/dashboard` with install/build commands run from the repo root (see Vercel section). |
| Widget renders on the dashboard but not on a customer site | Check browser console for CORS/CSP errors; the script is served with `Access-Control-Allow-Origin: *` but the customer's CSP must allow the script origin. |
