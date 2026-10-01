# Vouchreel

A video-testimonial widget SaaS that lets website owners paste a video link and instantly get a floating widget playing customer testimonials on their site.

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- [Docker](https://www.docker.com/) (for local PostgreSQL)
- npm (comes with Node.js)
- [FFmpeg](https://ffmpeg.org/download.html) on your PATH (video transcoding and social exports). Windows: `winget install Gyan.FFmpeg`; macOS: `brew install ffmpeg`; Debian/Ubuntu: `sudo apt install ffmpeg`. Set `FFMPEG_PATH` if it is installed elsewhere. The dashboard still runs without it, but video processing fails with a clear message; check `GET /api/health`.

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url> vouchreel
cd vouchreel

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your values (defaults work for local dev)

# 4. Start the database
npm run db:start

# 5. Run database migrations
npm run db:migrate

# 6. Build the embed widget once (required for embedding it locally)
npm run widget:build

# 7. Start the development server
npm run dev
```

The dashboard will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
vouchreel/
├── apps/
│   └── dashboard/          # Next.js 16 app (dashboard + API + marketing)
│       ├── app/            # App Router pages and API routes
│       ├── components/     # Shared UI components
│       └── lib/            # Core libraries (db, auth, storage, payments)
├── packages/
│   └── widget/             # Vanilla JS embed widget (bundled separately)
├── drizzle/
│   └── migrations/         # SQL migration files
├── turbo.json              # Turborepo configuration
├── docker-compose.yml      # Local Postgres + Dockerized app
├── docker-compose.production.yml  # Production overrides (VPS)
├── Dockerfile              # Multi-stage production image
└── .env.example            # Environment variable template
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start all packages in development mode |
| `npm run build` | Build all packages |
| `npm run lint` | Lint all packages |
| `npm run test` | Run tests across all packages |
| `npm run widget:build` | Build the embed widget bundle (outputs to `packages/widget/dist/` and `apps/dashboard/public/widget/`) |
| `npm run db:start` | Start local PostgreSQL via Docker (`docker compose up -d postgres`) |
| `npm run db:migrate` | Run database migrations |

### Dashboard-specific scripts

Run from `apps/dashboard/`:

| Script | Description |
|---|---|
| `npm run db:generate` | Generate a new migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio (database browser) |

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS v4
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: BetterAuth (email/password + Google OAuth)
- **Payments**: Stripe + Dodo Payments (admin-switchable)
- **Storage**: Pluggable adapter (S3 / Cloudflare R2 / Bunny.net)
- **Widget**: Vanilla JS + Shadow DOM (< 15 KB gzipped)
- **Monorepo**: Turborepo

## Environment Variables

See [.env.example](.env.example) for all variables with documentation, and [.env.production.example](.env.production.example) for production/VPS deployments.

## Documentation

- [Deployment Guide](docs/deployment.md) — VPS (Docker Compose) and Vercel deployments, widget CDN
- [Widget Integration Guide](docs/widget-integration.md) — for site owners embedding the widget
- [Implementation Plan](docs/implementation-plan.md) — architecture and sprint roadmap

## License

Private — All rights reserved.
