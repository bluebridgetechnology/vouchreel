# Vouchreel

A video-testimonial widget SaaS that lets website owners paste a video link and instantly get a floating widget playing customer testimonials on their site.

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- [Docker](https://www.docker.com/) (for local PostgreSQL)
- npm (comes with Node.js)

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

# 6. Start the development server
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
├── docker-compose.yml      # Local PostgreSQL
└── .env.example            # Environment variable template
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start all packages in development mode |
| `npm run build` | Build all packages |
| `npm run lint` | Lint all packages |
| `npm run test` | Run tests across all packages |
| `npm run db:start` | Start local PostgreSQL via Docker |
| `npm run db:migrate` | Run database migrations |

### Dashboard-specific scripts

Run from `apps/dashboard/`:

| Script | Description |
|---|---|
| `npm run db:generate` | Generate a new migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio (database browser) |

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: BetterAuth (email/password + Google OAuth)
- **Payments**: Stripe + Dodo Payments (admin-switchable)
- **Storage**: Pluggable adapter (S3 / Cloudflare R2 / Bunny.net)
- **Widget**: Vanilla JS + Shadow DOM (< 15 KB gzipped)
- **Monorepo**: Turborepo

## Environment Variables

See [.env.example](.env.example) for all required variables with documentation.

## License

Private — All rights reserved.
