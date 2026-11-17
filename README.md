<div align="center">

# ⚽ Football Analytics Platform

**A football analytics platform for live scores, fixtures, match insights, and
player and team statistics.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2F17-4169E1?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)](https://prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)

<p>
  <a href="#getting-started">Getting Started</a> ·
  <a href="#api-reference">API Reference</a> ·
  <a href="#deployment">Deployment</a>
</p>

<h3>Demo</h3>

<p>
  <a href="https://football-analytics-platform-iota.vercel.app/">Open the web app</a>
</p>

</div>

---

## 📸 Features

| Feature                | Description                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------- |
| 🟢 **Live scores**     | Scheduled score sync with Supabase Cron, Edge Functions, and Realtime       |
| 📅 **Fixtures**        | League and date filtering for the fixture calendar                         |
| 📊 **Match statistics**| Shots, possession, xG, cards, and corners                                  |
| 🗺️ **Shot maps**       | xG-weighted shot visualizations                                            |
| 🕸️ **Passing networks**| Average player positions and passing volume                               |
| 🏆 **Standings**       | League tables with promotion and relegation zones                          |
| 👥 **Teams**           | Team profiles, squads, and scouting reports                                |
| ⭐ **Players**         | Profiles, radar charts, form trends, and career statistics                  |
| 📈 **Analytics**       | Heatmaps, build-up patterns, PPDA, and player comparisons                   |
| 🔐 **Authentication**  | NextAuth.js credentials-based sign-in                                      |
| 🆓 **External data**   | Football data from football-data.org when an API key is configured          |

---

## 🏗️ Architecture

```mermaid
flowchart LR
    Browser[Browser]
    Web[Next.js on Vercel<br/>Web UI and API routes]
    Database[(Supabase PostgreSQL<br/>matches and match_scores)]
    Cron[Supabase Cron<br/>every minute]
    Function[Edge Function<br/>sync-live]
    Realtime[Supabase Realtime]

    Browser -->|HTTP| Web
    Web -->|Prisma| Database
    Cron --> Function
    Function -->|Update today's scores| Database
    Database -->|Database changes| Realtime
    Realtime -->|Realtime subscription| Browser
```

Production live scores use Supabase Cron, an Edge Function, and Supabase
Realtime. `apps/api`, `apps/realtime`, and Redis remain available for local or
legacy VM deployments; Vercel does not run the long-lived Socket.IO service.

Docker Compose provides PostgreSQL and Redis for local development. The web,
API, and realtime Node.js applications run locally with `pnpm dev`.

---

## 🛠️ Tech Stack

### Frontend (`apps/web`)

| Tool             | Version | Purpose                                     |
| ---------------- | ------- | ------------------------------------------- |
| Next.js          | 16      | App framework — SSR, App Router, API Routes |
| React            | 19      | UI library                                  |
| TypeScript       | 5       | Type safety                                 |
| Tailwind CSS     | 4       | Utility-first styling                       |
| Radix UI         | latest  | Accessible headless components              |
| Zustand          | 4.5     | Client state management                     |
| TanStack Query   | 5       | Server state & data fetching                |
| Recharts         | 2       | Charts (radar, area, bar)                   |
| Supabase JS      | 2       | Browser subscriptions to live match changes |

### Backend

| App             | Tool                | Purpose                      |
| --------------- | ------------------- | ---------------------------- |
| `apps/web`      | Next.js API Routes  | REST endpoints for all pages |
| `apps/api`      | Fastify 4           | Internal live-scores service |
| `apps/realtime` | Express + Socket.io | Legacy standalone WebSocket server |

### Database & Infrastructure

| Tool           | Version | Purpose                                                                    |
| -------------- | ------- | -------------------------------------------------------------------------- |
| PostgreSQL     | 16 / 17 | Local Docker / Supabase production database                               |
| Prisma         | 5       | Type-safe ORM + migrations                                                 |
| Redis          | 7       | Local development and legacy Socket.IO deployments                        |
| Docker Compose | v2      | Local DB + Redis containers                                                |

---

## 📁 Project Structure

```
Football-Analytics-Platform/          ← monorepo root
│
├── apps/
│   ├── web/                          # Next.js 16 — UI + API Routes  :3000
│   │   └── src/
│   │       ├── app/
│   │       │   ├── matches/, teams/, players/, standings/
│   │       │   └── api/              # REST handlers (see API Reference)
│   │       ├── components/           # players/, matches/, tactics/, ui/
│   │       ├── lib/                  # db-helpers, generators, analytics
│   │       └── providers/            # QueryProvider, SessionProvider
│   │
│   ├── api/                          # Fastify — legacy live-scores API :3002
│   │   └── src/
│   │       ├── routes/live-scores.ts
│   │       └── lib/prisma.ts
│   │
│   └── realtime/                     # Express + Socket.IO server :3001 (legacy)
│       └── src/
│           ├── socket/               # match, player, notification sockets
│           ├── handlers/             # event handlers
│           ├── middleware/           # auth (JWT), rateLimit, logger
│           └── config/env.ts
│
├── packages/
│   ├── database/                     # Prisma schema + migrations + seed
│   │   └── prisma/schema.prisma
│   ├── config/                       # Shared env config
│   ├── shared/                       # Shared utilities
│   └── types/                        # Shared TypeScript types
│
├── docker-compose.yml                # PostgreSQL :5433 + Redis :6379
├── docker/Dockerfile                 # Container build for the web app
├── package.json                      # Root scripts (pnpm -r dev/build)
└── pnpm-workspace.yaml
```

---

<a id="getting-started"></a>
## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 22 or later
- [pnpm](https://pnpm.io) 11.24.0 — `npm install -g pnpm@11.24.0`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL + Redis)

---

### Step 1 — Clone & install

```bash
git clone <your-repository-url>
cd Football-Analytics-Platform

pnpm install
```

---

### Step 2 — Configure environment

Copy the example env files and fill in your values:

```bash
# Root (Docker credentials)
cp .env.example .env

# Next.js app
cp apps/web/.env.example apps/web/.env

# Fastify API
cp apps/api/.env.example apps/api/.env

# Realtime Socket.io server
cp apps/realtime/.env.example apps/realtime/.env

# Prisma commands and database seed
cp packages/database/.env.example packages/database/.env

# Dedicated env files for current-season imports
cp packages/database/.env.development.example packages/database/.env.development
cp packages/database/.env.production.example packages/database/.env.production
```

For local development, set `DATABASE_URL` in the app env files and
`packages/database/.env` to the Docker database. The default URL is:

```env
DATABASE_URL="postgresql://postgres:change_me@localhost:5433/football?schema=public"
```

Set the same local password in the root `.env` and the local `DATABASE_URL`
values. URL-encode reserved characters in the password when placing it in a
PostgreSQL URL. Keep the production database URL only in
`packages/database/.env.production` or the hosting provider's secret settings.

Configure each service:

```env
# apps/web/.env
NEXTAUTH_SECRET="<random secret, at least 32 characters>"
NEXTAUTH_URL="http://localhost:3000"
FOOTBALL_DATA_API_KEY="your_free_key_from_football-data.org"
FOOTBALL_DATA_API_URL="https://api.football-data.org/v4"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"

# apps/api/.env
PORT=3002
HOST=0.0.0.0
NODE_ENV=development
WEB_APP_URL="http://localhost:3000"
REALTIME_INTERNAL_URL="http://localhost:3001"
INTERNAL_SERVICE_SECRET="<random secret, at least 32 characters>"

# apps/realtime/.env
REALTIME_PORT=3001
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_SECRET="<same value as apps/web/.env>"
INTERNAL_SERVICE_SECRET="<same value as apps/api/.env>"
REDIS_URL="redis://localhost:6379"

# packages/database/.env: local Docker URL; API key is used by seed and manual sync scripts
```

> **Note:** Docker exposes PostgreSQL on host port `5433` and maps it to
> container port `5432`. Use separate values for `NEXTAUTH_SECRET` and
> `INTERNAL_SERVICE_SECRET`; share each only with the services that require it.
> Never commit real `.env` files.

---

### Step 3 — Start the database

```bash
# Start PostgreSQL + Redis only (not the app)
docker compose up -d postgres redis

# Verify they are healthy
docker compose ps
```

---

### Step 4 — Set up the database

```bash
# Generate the Prisma client (required after clone or schema changes)
pnpm db:generate

# Push schema to the database (creates all tables)
pnpm db:push

# Seed sample data
pnpm db:seed
```

`pnpm db:seed` fetches the current Premier League season and upserts teams,
fixtures, results, and scores into the database configured in
`packages/database/.env`. It does not delete existing rows.

For a one-time current-season import, use the target-specific command and env
file for the database you intend to update:

```bash
pnpm db:sync-current:dev         # reads packages/database/.env.development
pnpm db:sync-current:production  # reads packages/database/.env.production
```

Both env files need `DATABASE_URL` and `FOOTBALL_DATA_API_KEY`. The dedicated
commands load only their named file, so they do not depend on or change
`packages/database/.env`.

To run a one-time live sync against the local database, use:

```bash
pnpm db:sync-live
```

Production live scores are refreshed by the Supabase Cron job and Edge
Function; do not run the local watcher as a Vercel production worker.

---

### Step 5 — Run the dev servers

```bash
pnpm dev
```

This starts all three workspace applications for local development. The Fastify
API and Socket.IO service are legacy components and are not used by the current
Vercel production architecture.

| App             | URL                   | Description         |
| --------------- | --------------------- | ------------------- |
| `apps/web`      | http://localhost:3000 | Next.js — main UI   |
| `apps/realtime` | http://localhost:3001 | Legacy Socket.IO server |
| `apps/api`      | http://localhost:3002 | Legacy Fastify API      |

---

### Subsequent runs (after first setup)

```bash
docker compose up -d postgres redis   # if not already running
pnpm dev
```

---

<a id="api-reference"></a>
## 📡 API Reference

The production API is served by the Next.js application at `/api/*`. Dynamic
route segments are shown in brackets. The health endpoint reports web-service
liveness only; it does not check the database or scheduled sync pipeline.

### Matches

| Method | Route                              | Description                    |
| ------ | ---------------------------------- | ------------------------------ |
| GET    | `/api/matches`                     | Matches; defaults to `IN_PLAY,PAUSED` |
| GET    | `/api/matches/[id]`                | Match details and score        |
| GET    | `/api/matches/[id]/stats`          | Match statistics               |
| GET    | `/api/matches/[id]/tactics`        | Tactical analysis              |
| GET    | `/api/matches/[id]/shots`          | Match shot data                |
| GET    | `/api/matches/[id]/provider-events`| Provider match events          |
| GET    | `/api/health`                      | Web service liveness check     |

Use the comma-separated `status` query parameter to filter `/api/matches`, for
example `?status=IN_PLAY,PAUSED`.

### Competitions

| Method | Route                                | Description                  |
| ------ | ------------------------------------ | ---------------------------- |
| GET    | `/api/competitions/[code]/matches`   | All matches in a competition |
| GET    | `/api/competitions/[code]/standings` | League table                 |
| GET    | `/api/competitions/[code]/teams`     | Teams in competition         |
| GET    | `/api/competitions/[code]/seasons`   | Competition seasons          |

### Players

| Method | Route                       | Description                     |
| ------ | --------------------------- | ------------------------------- |
| GET    | `/api/persons`              | Search players (`?query=salah`) |
| GET    | `/api/persons/[id]`         | Player profile + stats          |
| GET    | `/api/persons/[id]/form`    | Form trend (last N matches)     |
| GET    | `/api/persons/[id]/career`  | Career statistics timeline      |
| GET    | `/api/persons/[id]/similar` | Similar players                 |
| GET    | `/api/persons/[id]/heatmap` | Player heatmap data              |
| GET    | `/api/persons/[id]/photo`   | Player photo                     |
| GET    | `/api/persons/compare`      | Head-to-head comparison         |

### Teams

| Method | Route                      | Description              |
| ------ | -------------------------- | ------------------------ |
| GET    | `/api/teams/[id]`          | Team profile             |
| GET    | `/api/teams/[id]/matches`  | Team fixture list        |
| GET    | `/api/teams/[id]/scouting` | Opponent scouting report |

### Other

| Method | Route                     | Description               |
| ------ | ------------------------- | ------------------------- |
| GET    | `/api/predictions/season` | Season finish predictions |
| GET    | `/api/platform-stats`     | Platform overview metrics |
| *      | `/api/auth/[...nextauth]` | NextAuth.js authentication |

---

<!-- Legacy VM + Socket.IO deployment retained for reference. The production
Supabase path below does not use this server contract.

## 🔌 Legacy WebSocket Events

Connected to `apps/realtime` (default `http://localhost:3001`).

```
Client emits:
  match:join               { matchId }    – join a match room
  match:leave              { matchId }    – leave a match room
  match:get-score          { matchId }    – request the current score
  match:get-all-live                       – request all live matches
  notification:subscribe   { matchId }    – subscribe to match notifications

Server broadcasts:
  score:updated           { matchId, homeScore, awayScore, minute, status }
  match:score             LiveScore
  match:goal              { event, score }
  match:status             LiveScore
  player:stats             PlayerStats
  notification:push        Notification
```

Redis backs shared live-score state and rate limits, and the Socket.io Redis
adapter distributes room broadcasts across realtime instances. Redis is
optional in development (without `REDIS_URL`, realtime uses in-memory state),
but required in production. Set `REDIS_URL` to a private Redis endpoint; use
`rediss://` when the provider requires TLS. Deploy the realtime service
separately from the web container and point every realtime instance at the same
Redis deployment.

---

-->

<a id="deployment"></a>
## 🚀 Production deployment (Vercel + Supabase)

### Production site

The current production domain is
[football-analytics-platform-iota.vercel.app](https://football-analytics-platform-iota.vercel.app/).
Vercel is connected to the GitHub `main` branch and deploys a new production
version when changes are pushed to that branch.

### Architecture and required setup

- **Web and API routes:** Next.js hosted on Vercel.
- **Database:** Supabase PostgreSQL, accessed by the app through Prisma.
- **Live score updates:** Supabase Cron calls the `sync-live` Edge Function
  every minute. The function fetches today's matches from football-data.org,
  updates existing `matches` and `match_scores`, and Supabase Realtime notifies
  connected browsers.
- **Initial data import:** `pnpm db:sync-current:production` manually imports
  the current competition season into Supabase. The scheduled function does
  not create missing fixtures.
- **Socket.IO, Fastify, and Redis:** legacy/self-hosted services; they are not
  needed for this Vercel production setup.

### 1. Vercel environment variables

In Vercel open **Project → Settings → Environment Variables**. Add these for
**Production** (and Preview too if preview deployments should access the same
database), then redeploy:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **Transaction Pooler** connection string; keep it private |
| `NEXTAUTH_SECRET` | Random secret, at least 32 characters |
| `NEXTAUTH_URL` | `https://football-analytics-platform-iota.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | `https://football-analytics-platform-iota.vercel.app` |
| `FOOTBALL_DATA_API_KEY` | API token from football-data.org (server-side only) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vdgozqxytqssjusxgxbt.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key from **Project Settings → API Keys** |

Do not add `/rest/v1` to the Supabase URL. Never put the database password,
`SUPABASE_SERVICE_ROLE_KEY`, or any secret in a `NEXT_PUBLIC_` value. After
changing variables, use **Deployments → Redeploy** so the production build
receives them.

### 2. Supabase schema and live updates

The production project already has its tables and current season data. For a
new, empty Supabase project, bootstrap the Prisma schema once before applying
the Realtime migration. Set the `DATABASE_URL` in
`packages/database/.env` to that project and run `pnpm db:push`; then import
fixtures with `pnpm db:sync-current:production`.
`db:push` is only for initial schema setup, not routine production deployments.
After that, complete these steps:

1. In **SQL Editor**, run
   [the Realtime/RLS migration](supabase/migrations/202611150001_realtime_match_updates.sql).
   It grants anonymous read access to match and score rows and adds both tables
   to the `supabase_realtime` publication.
2. In **Database → Extensions**, make sure `pg_cron`, `pg_net`, and
   `supabase_vault` are enabled.
3. In **Edge Functions**, deploy a function named `sync-live` using
   [`supabase/functions/sync-live/index.ts`](supabase/functions/sync-live/index.ts).
   Add these function secrets in its **Secrets** settings:
   `FOOTBALL_DATA_API_KEY` and `SYNC_FUNCTION_SECRET` (a random private value).
   Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge
   Functions automatically; never expose the service-role key to the browser.
4. In **SQL Editor**, run
   [`supabase/schedule-sync-live.sql.example`](supabase/schedule-sync-live.sql.example)
   once after replacing its example values. The script stores `project_url`,
   `publishable_key`, and `sync_secret` in Vault, then creates a one-minute Cron
   job. Use the base project URL (no `/rest/v1` or trailing slash), the
   publishable/anon key, and the same random sync secret configured on the
   Edge Function. Do not rerun the Vault `create_secret` statements if those
   secret names already exist.

These steps describe the dashboard setup currently in use. The SQL and function
source are committed here for review and reuse. Changing a function file in
GitHub does not itself update the deployed Supabase function; deploy changed
function code separately from Supabase **Edge Functions**.

### 3. Verify the scheduled sync

Run these queries in Supabase **SQL Editor**:

```sql
select jobname, schedule, command from cron.job;

select status_code, content, error_msg, created
from net._http_response
order by created desc
limit 10;
```

`200` with `{"ok":true,"processed":0}` means the function was reached but
found no provider matches for today (or no matching IDs already in the DB).
When a match is scheduled for today, `processed` should be greater than zero.
Dashboard Edge Function Logs can be empty on successful runs; inspect
`net._http_response` and `cron.job_run_details` for Cron results.

If the production database has not been populated yet, configure
`packages/database/.env.production` with the Supabase `DATABASE_URL` and
`FOOTBALL_DATA_API_KEY`, then run from the repository root:

```bash
pnpm db:generate
pnpm db:sync-current:production
```

For the local Docker database, configure `packages/database/.env.development`
and run `pnpm db:sync-current:dev`. Each command loads only its named env file,
so it won't switch the target configured for the other command. These commands
import/update the current Premier League season. Do not run `db:push` against
production as a routine deploy step; use reviewed Prisma migrations when
changing the schema. If a Supabase Free project is paused, restore it from the
Supabase Dashboard before Cron, Realtime, or website database access can work
again.

---

## 🐳 Docker

```bash
# Start infrastructure (PostgreSQL + Redis) — for local dev
docker compose up -d postgres redis

# Stop infrastructure
docker compose down

# Build and run the web container with PostgreSQL and Redis
docker compose --profile prod up -d --build

# View logs
docker compose logs -f postgres
```

> **For local development**, only run `postgres` and `redis` via Docker.  
> The Node.js apps (`web`, `api`, `realtime`) run locally with `pnpm dev`.

For local development, the application processes run on your computer, so
`DATABASE_URL` must use `localhost:5433`. Containers on the Compose network use
the hostname `postgres` and container port `5432` instead.

### View the Docker PostgreSQL database in DBeaver

After `docker compose up -d postgres`, create a PostgreSQL connection in DBeaver:

| Setting  | Value                                                      |
| -------- | ---------------------------------------------------------- |
| Host     | `localhost`                                                |
| Port     | `5433`                                                     |
| Database | `POSTGRES_DB` from the root `.env` (default: `football`)   |
| Username | `POSTGRES_USER` from the root `.env` (default: `postgres`) |
| Password | `POSTGRES_PASSWORD` from the root `.env`                   |

Test the connection, then browse `Databases → football → Schemas → public →
Tables`. Run `pnpm db:push` from the repository root first to create/update
tables from `packages/database/prisma/schema.prisma`. To view relationships,
right-click the `public` schema or selected tables and choose **ER Diagram**.

The named Docker volume preserves database data when containers stop. Avoid
`docker compose down -v` unless you intend to delete that data.

---

## 🔧 Useful Scripts

```bash
pnpm dev                   # start all apps (web + api + realtime)
pnpm build                 # build all apps
pnpm lint                  # lint all packages

pnpm db:generate           # (re)generate Prisma client
pnpm db:push               # sync schema to DB (no migration file)
pnpm db:migrate            # create a named migration
pnpm db:migrate:deploy     # apply committed migrations (production releases)
pnpm db:seed               # seed sample data
pnpm db:studio             # open Prisma Studio at localhost:5555
pnpm db:sync-current:dev   # import current fixtures into local Docker DB
pnpm db:sync-current:production # import current fixtures into Supabase
pnpm db:sync-live          # one-time live sync using packages/database/.env
pnpm db:sync-live:watch    # local repeating sync; not a Vercel worker

# Run a single app
pnpm --filter @app/web       dev
pnpm --filter @app/api       dev
pnpm --filter @app/realtime  dev
```

---

## 🧪 Validation

Run these checks from the repository root before submitting changes:

```bash
pnpm type-check
pnpm build
pnpm test
```

The repository does not yet contain automated test files, so `pnpm test` has no
test cases to execute.

---

## ⚠️ Known Limitations

- Live-score refreshes update fixtures already stored in PostgreSQL. They do not
  discover or import new fixtures automatically.
- Live-score freshness depends on the scheduled job and the availability and
  rate limits of football-data.org, Supabase Edge Functions, and Realtime.
- The Vercel health endpoint reports web-service liveness; it does not verify
  database connectivity or the status of the scheduled sync pipeline.
- The Fastify API and standalone Socket.IO server are retained for local or
  self-hosted use and are not part of the current Vercel production deployment.
- The web lint script uses `next lint`, which is unsupported by the current
  Next.js CLI and needs to be migrated to the ESLint CLI.
- Supabase Free projects may pause after a period of inactivity.

---

## 📄 License

No `LICENSE` file is currently included in this repository. As a result, no
open-source license or reuse and redistribution terms have been specified.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m "feat: add my feature"`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request

---

<div align="center">
  Built with ⚽ and lots of ☕
</div>
