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

# Standalone Prisma and seed commands
cp packages/database/.env.example packages/database/.env

# Local development and production release
cp packages/database/.env.development.example packages/database/.env.development
cp packages/database/.env.production.example packages/database/.env.production
```

For local development, set `DATABASE_URL` in `packages/database/.env.development`
to the Docker database. `pnpm dev` passes that same URL to all three apps.
Use the same URL in the app env files if you launch an app on its own. The
default URL is:

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

`pnpm apply:dev` reads `packages/database/.env.development`, applies pending
migrations, creates and applies a migration for any new Prisma schema changes,
and regenerates Prisma Client. Pass a descriptive name when changing the schema,
for example `pnpm apply:dev player_provenance`.

```bash
pnpm apply:dev

# Optional initial fixture import
pnpm db:sync-current:dev
```

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

This first applies database changes and generates Prisma Client, then starts
all three workspace applications. Code edits reload in the running dev servers.
After a Prisma schema edit, restart with `pnpm dev` to load the regenerated
client. Use `pnpm apply:dev` when you only want to apply the database changes.
The Fastify API and Socket.IO service are used for local or self-hosted setups.

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
route segments are shown in brackets. Use `/api/health` for liveness and
`/api/health/ready` for database connectivity.

Open **`/api/docs`** for Swagger UI or fetch **`/api/openapi`** for the OpenAPI 3.1
document. It covers the web API and the self-hosted Fastify and realtime HTTP
service endpoints. Use the signed-in browser for session-protected reads.
Swagger's interactive requests are limited to GET.

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
| GET    | `/api/health/ready`                | Database readiness (200 or 503) |

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
| GET    | `/api/predictions/season` | Season finish predictions (signed in) |
| GET    | `/api/platform-stats`     | Platform overview metrics (administrator) |
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

After validating locally, commit the code and any new migration on `main`,
then run this from the repository root.

```bash
pnpm apply:prod
```

The command checks that Git can push the release, applies committed migrations
using `packages/database/.env.production`, and then pushes the release commit
to `origin/main`. Vercel builds and publishes the pushed commit. A failed
migration stops the release before the push.

### Architecture and required setup

- **Web and API routes:** Next.js hosted on Vercel.
- **Database:** Supabase PostgreSQL, accessed by the app through Prisma.
- **Live score updates:** Supabase Cron calls the `sync-live` Edge Function
  every minute. The function fetches today's matches from football-data.org,
  updates existing `matches` and `match_scores`. PostgreSQL publishes a minimal
  signal through `live_match_updates`, then browsers refetch the public API.
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

1. Set `DATABASE_URL` in `packages/database/.env.production` to the intended
   Supabase project's direct or session pooler URL, then run
   `pnpm apply:prod` to release code and apply its committed migrations. This creates the
   schema, row policies and public Realtime signal, and removes raw match tables
   from the publication. Deploy the web app alongside this database change so its
   subscription uses `live_match_updates`. For a new database, import fixtures with
   `pnpm db:sync-current:production` after migration. If the database was created
   using `db:push`, reconcile and baseline its existing schema against the
   committed migration history before applying pending migrations.
2. In **Database → Extensions**, make sure `pg_cron`, `pg_net`, and
   `supabase_vault` are enabled.
3. After the Prisma migrations are applied, deploy a function named `sync-live` in **Edge Functions** using
   [`supabase/functions/sync-live/index.ts`](supabase/functions/sync-live/index.ts).
   Add these function secrets in its **Secrets** settings:
   `FOOTBALL_DATA_API_KEY` and `SYNC_FUNCTION_SECRET` (a random private value).
   Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge
   Functions automatically. The function calls the service-only
   `apply_live_match_updates` database function to commit status and score together.
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

# Build and run the local web container with PostgreSQL and Redis
docker compose --env-file .env --env-file apps/web/.env --profile prod up -d --build

# View logs
docker compose logs -f postgres
```

> **For local development**, only run `postgres` and `redis` via Docker.  
> The Node.js apps (`web`, `api`, `realtime`) run locally with `pnpm dev`.

For local development, the application processes run on your computer, so
`DATABASE_URL` must use `localhost:5433`. Containers on the Compose network use
the hostname `postgres` and container port `5432` instead.
The Docker build receives the Supabase URL and publishable key for the browser
bundle. Server credentials are injected at runtime through the web env file.

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
Tables`. Run `pnpm apply:dev` from the repository root first to apply the
committed schema and triggers. To view relationships,
right-click the `public` schema or selected tables and choose **ER Diagram**.

The named Docker volume preserves database data when containers stop. Avoid
`docker compose down -v` unless you intend to delete that data.

---

## 🔧 Useful Scripts

```bash
pnpm dev                   # apply local schema changes and start all dev apps
pnpm apply:dev [name]      # apply local schema changes without starting apps
pnpm apply:prod            # migrate Supabase and release the committed main branch
pnpm build                 # build all apps
pnpm lint                  # lint the web workspace
pnpm check                 # lint, type-check, and run tests

pnpm db:generate           # (re)generate Prisma client
pnpm db:push               # sync schema to DB (no migration file)
pnpm db:migrate            # create a named migration
pnpm db:migrate:deploy     # standalone migration command using the configured DATABASE_URL
pnpm db:seed               # seed sample data
pnpm db:studio             # open Prisma Studio at localhost:5555
pnpm db:sync-current:dev   # import current fixtures into local Docker DB
pnpm db:sync-current:production # import current fixtures into Supabase
pnpm db:audit-analytics development # read-only counts and data provenance in the local database
pnpm db:audit-analytics production  # read-only counts and migration history in Supabase
pnpm db:sync-live          # one-time live sync using packages/database/.env
pnpm db:sync-live:watch    # local repeating sync; not a Vercel worker

# Run a single app
pnpm --filter @app/web       dev
pnpm --filter @app/api       dev
pnpm --filter @app/realtime  dev
```

To populate verified historical Premier League scouting, career, and comparison
data, import the official fixture IDs for a season first, then match the
API-Football profiles. Pairing requires a matching player name and date of birth,
or an existing verified provider ID. The importer keeps each club and season
separate. Preview a single club with `--team=42 --pages=1`.

```bash
pnpm db:sync-current:production --season=2024
pnpm db:import-api-football production --season=2024 --team=42 --pages=1
pnpm db:import-api-football production --season=2024 --write
```

The API-Football importer reads the provider configuration from the shell or
`apps/web/.env` and uses the named database environment. Resume a partial
import with `--from-team=ID --page=N` after the provider quota resets.

### Recorded Premier League player analytics

Apply migrations before running the importers. The player profile and Similar
Players can read existing API-Football season snapshots. Similar Players and
the imported positional average compare the player's season and position
against peers with at least 90 recorded minutes. Highlightly season totals are
calculated from the available imported match rows, so the matches played value
also shows the coverage of a partial import.

Set `HIGHLIGHTLY_API_KEY` in `packages/database/.env.development` or the shell.
The first run previews matching and coverage. Add `--write` to save rows.
Player match imports use existing local fixtures and player mappings. The
API-Football option requires previously linked fixture and player IDs. Use
`--offset=N` to process the next group of fixtures in the season.

```bash
pnpm db:import-player-matches development --source=highlightly --season=2026 --limit=10
pnpm db:import-player-matches development --source=api-football --season=2024 --limit=10 --write
```

For historical action heatmaps, download the [Wyscout public dataset](https://doi.org/10.6084/m9.figshare.c.4415000)
and extract the England files. For player shot maps, the importer accepts the
`pl-catalogue` fixtures, players, appearances and shots files. Confirm the
[upstream data terms](https://github.com/oladeeayo/pl-catalogue#license-and-attribution)
before publishing shot data. Both imports match player identities against the
local database and skip records that cannot be resolved uniquely. Use absolute
paths for input files and add `--write` to save the previewed data.

```bash
pnpm db:import-player-pitch development --source=wyscout --players=/data/players.json --fixtures=/data/matches_England.json --events=/data/events_England.json
pnpm db:import-player-pitch development --source=shots --season=2026 --players=/data/players.csv --fixtures=/data/fixtures.csv --appearances=/data/gws/merged_gw.csv --events=/data/shots.csv
```

Premier League fixture predictions and season simulations share a Poisson
model with a 365-day half-life and a six-match prior. The model uses
[OpenFootball results](https://github.com/openfootball/football.json) from
2018/19 through 2025/26 (CC0), supplemented by recorded results before the
prediction day. The bundled archive records the input file hashes. Regenerate
it with `node tools/build-openfootball-history.mjs /path/to/football.json`.

---

## Authentication and service access

Email/password sign-in uses a NextAuth v4 encrypted session cookie. The browser
sends the HttpOnly, SameSite=Lax cookie on same-origin calls. HTTPS deployments
enable Secure cookies. NextAuth renews its session cookie on session requests
within an eight-hour rolling window and PostgreSQL enforces a seven-day absolute
limit. Sign-out revokes the server-side session. The login does not issue a
separate OAuth access token or refresh token. Existing cookies from releases
without a server-side session ID require a fresh sign-in.

Invalid email and password attempts share the same credentials error. Login
limits are enforced atomically in PostgreSQL for 15-minute windows (five per
email, 30 per trusted IP, or a shared fallback if there is no trusted IP).
Passwords use bcrypt and have a 72-byte UTF-8 limit. Vercel provides the trusted
IP. For self-hosting, enable `AUTH_TRUST_PROXY_IP=true` after configuring ingress
to overwrite `X-Real-IP` with the actual client IP and blocking direct access to
the Next.js listener.

Use the deployment's own HTTPS origin in `NEXTAUTH_URL`, including previews that
accept sign-ins. The browser API is same-origin and writes require that Origin
header. Public match and player data remain available. The season forecast
requires sign-in, and operational platform stats require the database `ADMIN`
role. Personal dashboard, favorite, prediction and push records are scoped to the
signed-in account.

For legacy self-hosted services, configure `WEB_APP_URL` in Fastify and
`NEXT_PUBLIC_APP_URL` in realtime with the exact web origin. Socket.IO clients
can subscribe to updates, and score changes use the service endpoints.
Fastify score writes require `Authorization: Bearer <LIVE_SCORE_WRITE_SECRET>`
on a server-to-server request. Configure this optional secret only if you
use those writes. Realtime broadcasting uses a separate `INTERNAL_SERVICE_SECRET`.
Keep both values outside client configuration, and use a Supabase publishable
or anon key for the browser.

---

## Dashboard, exports, and Web Push

Sign in at `/dashboard`, follow a club from its team page, and save a result
prediction on a match page before kickoff. The dashboard lists upcoming matches
for followed clubs and the latest saved predictions for the signed-in account.
Download CSV or PDF from the standings or from the detailed statistics on a
player profile. The language control in the header persists English or Vietnamese
for the browser. Some existing chart annotations and generated reports are in
English.

The app registers its service worker in production. Supported browsers display
**Install app** in the header. The worker caches recently visited public pages
and data for offline access. Personal dashboard data, auth endpoints, and live
scores are fetched from the network.

To enable goal and final-score push notifications:

1. Apply the Prisma migrations with `pnpm apply:dev` locally or `pnpm apply:prod`
   for a production release. The score
   trigger creates queued notifications for browsers subscribed by users who follow
   either club.
2. Run `pnpm --filter @app/database exec web-push generate-vapid-keys`. Set
   `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` on the web server
   for Supabase deployments or on the database sync worker for self-hosted delivery.
   The web server also needs `VAPID_PUBLIC_KEY` in the self-hosted setup.
3. For Supabase, set a shared random `PUSH_DISPATCH_SECRET` of at least 32 characters
   in the web server and the `sync-live` Edge Function. Set `PUSH_DISPATCH_URL` in
   the Edge Function to the absolute web URL ending in `/api/internal/push`.
   Redeploy the Edge Function so the existing cron invokes delivery after each sync.
   The self-hosted `db:sync-live:watch` worker dispatches directly.
4. Open the app over HTTPS, follow a club, then opt in from the dashboard on each
   device that should receive alerts. On iOS, open the app after adding it to the
   Home Screen.

Keep the same VAPID key pair across releases to preserve browser subscriptions.
Legacy analytics without recorded provenance display an unverified source label.
New imports may use `PlayerStats.dataSource` and `MatchEvent.analyticsSource` to
record `REAL` or `GENERATED` when the source is known.

---

## Match comments, AI insights, xG, and club colors

Apply the database migration with `pnpm apply:dev` locally or `pnpm apply:prod`
for a production release. Match
comments are public to read. Signed-in users can post and delete their own
comments. Administrators can also remove comments. Use **Copy prediction link**
on the match page or dashboard to share a pick without including your account
details. On a team page with recognized club colors, choose **Use club colors**.
The accent is saved for the browser and can be cleared from the header's
Appearance menu.

For optional AI previews and reviews, set `MATCH_INSIGHTS_HF_TOKEN` to a token
with Inference Providers access and set `MATCH_INSIGHTS_MODEL` to a chat model
available to that account. Opening an eligible match page while signed in
automatically requests a missing insight in the selected language. Existing
insights are public to read. The service uses fixture results and recorded
statistics, caches completed generations, and admits at most 50 generation
requests per UTC day across the deployment.
See [Hugging Face Chat Completion](https://huggingface.co/docs/inference-providers/tasks/chat-completion).

The shot map estimates xG with a logistic model using shot distance, goal angle,
body part, shot context, and pre-match form for both teams. Form uses up to five
recorded matches in the same competition season over the previous 60 days.
Recent results carry more weight, and only fixtures dated before the match
contribute to the averages for points, goals scored, and goals conceded.

The model trained on 16,302 shots from 635 matches across 18 competitions and
55 seasons. The sample covers all domestic competitions and World Cups in the
pinned StatsBomb Open Data snapshot, with up to 20 matches per competition
season. Coverage is historical and varies by competition. On 4,132 shots held
out chronologically within each competition, Brier score was 0.08907 with form,
0.08925 using shot features alone, and 0.10508 for a constant goal rate.
[`xg-model.json`](apps/web/src/models/xg-model.json) records the source revision,
coverage by competition, and validation metrics.

Download the pinned [StatsBomb Open Data](https://github.com/hudl/open-data)
sample and retrain, or use a local checkout.

```bash
node tools/train-xg.mjs --download /tmp/football-xg
node tools/train-xg.mjs /path/to/open-data/data
```

`GET /api/matches/{id}/shots` reports the prior match count for each team through
`form` and indicates which shots use it via `usesForm`. The model uses shot
features alone when neither team has recorded form. The API preserves provider
xG separately. Shootouts are excluded, and modeled xG requires valid StatsBomb
coordinates.

---

## 🧪 Validation

Run these checks from the repository root before submitting changes:

```bash
pnpm db:generate
pnpm check
pnpm build
```

`pnpm test` runs Jest unit tests, App Router handler tests with mocked data
dependencies, and React component tests. The tests do not require a database or
provider credentials. Use `pnpm test:coverage` to generate a coverage report.

The [GitHub CI workflow](.github/workflows/ci.yml) runs lint, type checks, tests
and builds on pull requests and pushes to `main` with build-only placeholders.
Vercel runs `pnpm check` before building the web app. The current
`pnpm apply:prod` command applies migrations and pushes directly to `main`.
If you switch to PR-only releases, require the CI check named
**Lint, type-check, test, and build** in the GitHub ruleset and update the release
workflow to preserve the migration-before-deploy order.

Use `GET /api/health` to check that the web process responds, and
`GET /api/health/ready` to check database connectivity. Readiness returns 503
if the database probe fails or exceeds two seconds. Web request errors and
failed readiness probes emit JSON events in the deployment logs.

---

## ⚠️ Known Limitations

- Live-score refreshes update fixtures already stored in PostgreSQL. They do not
  discover or import new fixtures automatically.
- Live-score freshness depends on the scheduled job and the availability and
  rate limits of football-data.org, Supabase Edge Functions, and Realtime.
- Readiness checks PostgreSQL. Scheduled sync and upstream provider health
  have separate logs.
- The Fastify API and standalone Socket.IO server are retained for local or
  self-hosted use and are not part of the current Vercel production deployment.
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
