<div align="center">

# ⚽ Football Analytics Platform

**A production-ready fullstack monorepo for real-time football data,  
match analytics, tactical insights, and player/team statistics.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)](https://prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Live Demo](#) · [API Docs](#-api-reference)

</div>

---

## 📸 Features

| Feature | Description |
|---------|-------------|
| 🟢 **Live Scores** | Real-time score updates via WebSocket (Socket.io) |
| 📅 **Fixtures** | Full fixture calendar with filters by league & date |
| 📊 **Match Stats** | Shots, possession, xG, cards, corners per match |
| 🗺️ **Shot Map** | xG-weighted shot map rendered on a pitch canvas |
| 🕸️ **Passing Network** | Average-position passing graph with touch volume |
| 🏆 **Standings** | League table with promotion/relegation zone colours |
| 👥 **Teams** | Team profiles, squad lists, scouting reports |
| ⭐ **Players** | Search, profiles, radar charts, form trend, career stats |
| 📈 **Analytics** | Heatmaps, build-up patterns, PPDA meter, comparisons |
| 🔐 **Auth** | NextAuth.js session — register, login, user favourites |
| 🆓 **Free APIs** | Works with football-data.org (free tier, 100 req/day) |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────┐
│           Browser  (Next.js 16 + React 19)          │
│  TanStack Query · Zustand · Socket.io-client        │
└──────────────┬───────────────────┬─────────────────┘
               │ HTTP/S            │ WebSocket
┌──────────────▼──────────┐  ┌────▼──────────────────┐
│   apps/web  :3000        │  │  apps/realtime  :3001  │
│  Next.js App Router      │  │  Express + Socket.io   │
│  SSR + API Routes        │  │  JWT auth middleware   │
└──────────────┬───────────┘  └────┬──────────────────┘
               │                   │
        ┌──────▼───────────────────▼──────┐
        │       packages/database          │
        │  Prisma ORM  ←→  PostgreSQL:5433 │
        └──────────────────────────────────┘
               │
        ┌──────▼──────┐
        │  apps/api    │  :3002  Fastify REST (internal)
        │  live-scores │
        └─────────────┘
```

> **Docker** chỉ chạy **PostgreSQL + Redis** (infrastructure).  
> Cả 3 Node.js apps chạy local bằng `pnpm dev`.

---

## 🛠️ Tech Stack

### Frontend (`apps/web`)
| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 16 | App framework — SSR, App Router, API Routes |
| React | 19 | UI library |
| TypeScript | 5.4 | Type safety |
| Tailwind CSS | 4 | Utility-first styling |
| Radix UI | latest | Accessible headless components |
| Zustand | 4.5 | Client state management |
| TanStack Query | 5 | Server state & data fetching |
| Recharts | 2 | Charts (radar, area, bar) |
| Socket.io-client | 4.7 | Real-time WebSocket updates |

### Backend
| App | Tool | Purpose |
|-----|------|---------|
| `apps/web` | Next.js API Routes | REST endpoints for all pages |
| `apps/api` | Fastify 4 | Internal live-scores service |
| `apps/realtime` | Express + Socket.io | WebSocket push server |

### Database & Infrastructure
| Tool | Version | Purpose |
|------|---------|---------|
| PostgreSQL | 16 | Primary relational database |
| Prisma | 5 | Type-safe ORM + migrations |
| Redis | 7 | Socket.io adapter / pub-sub |
| Docker Compose | v2 | Local DB + Redis containers |

---

## 📁 Project Structure

```
Football-Analytics-Platform/          ← monorepo root
│
├── apps/
│   ├── web/                          # Next.js 16 — UI + API Routes  :3000
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (pages)/          # matches, teams, players, standings…
│   │       │   └── api/              # REST handlers (see API Reference)
│   │       ├── components/           # players/, matches/, tactics/, ui/
│   │       ├── lib/                  # db-helpers, generators, analytics
│   │       └── providers/            # QueryProvider, SessionProvider
│   │
│   ├── api/                          # Fastify — internal live-scores  :3002
│   │   └── src/
│   │       ├── routes/live-scores.ts
│   │       └── lib/prisma.ts
│   │
│   └── realtime/                     # Express + Socket.io server  :3001
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
├── docker/Dockerfile                 # Production multi-stage build
├── package.json                      # Root scripts (pnpm -r dev/build)
└── pnpm-workspace.yaml
```

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 20
- [pnpm](https://pnpm.io) ≥ 9 — `npm install -g pnpm`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL + Redis)

---

### Step 1 — Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/Football-Analytics-Platform.git
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
```

Use the same `DATABASE_URL` in `apps/web/.env`, `apps/api/.env`,
`apps/realtime/.env`, and `packages/database/.env`. With the root
`.env.example` defaults:

```env
DATABASE_URL="postgresql://postgres:change_me@localhost:5433/football?schema=public"
```

Replace `change_me` in the root `.env` with a local database password, then use
that same password in `DATABASE_URL`. URL-encode the password in `DATABASE_URL`
if it contains reserved URL characters.

Configure each service:

```env
# apps/web/.env
NEXTAUTH_SECRET="<random secret, at least 32 characters>"
NEXTAUTH_URL="http://localhost:3000"
FOOTBALL_DATA_API_KEY="your_free_key_from_football-data.org"
FOOTBALL_DATA_API_URL="https://api.football-data.org/v4"
NEXT_PUBLIC_WEBSOCKET_URL="http://localhost:3001"

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

# packages/database/.env: FOOTBALL_DATA_API_KEY is needed only by pnpm db:seed
```

> **Note:** Port is `5433` (Docker maps host `5433` → container `5432`).
> Generate two separate secrets, each at least 32 characters: share
> `NEXTAUTH_SECRET` between web/realtime and `INTERNAL_SERVICE_SECRET` between
> API/realtime. Never commit `.env` files.
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
fixtures, results, and scores into PostgreSQL. Run it again to refresh the
season's fixture/results snapshot from football-data.org; it does not delete
existing rows. The live poller only refreshes today's matches that are already
in the database, so it cannot import a new season by itself.

To refresh scores/statuses for today's matches on demand, run:

```bash
pnpm db:sync-live
```

Both commands require `FOOTBALL_DATA_API_KEY` in `packages/database/.env`.
The automatic web poller also needs the key in `apps/web/.env`.

---

### Step 5 — Run the dev servers

```bash
pnpm dev
```

This starts all 3 apps simultaneously:

| App | URL | Description |
|-----|-----|-------------|
| `apps/web` | http://localhost:3000 | Next.js — main UI |
| `apps/realtime` | http://localhost:3001 | Socket.io server |
| `apps/api` | http://localhost:3002 | Fastify live-scores |

---

### Subsequent runs (after first setup)

```bash
docker compose up -d postgres redis   # if not already running
pnpm dev
```

---

## 📡 API Reference

All routes are served by `apps/web` (`/api/*`).

### Matches
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/matches` | Live / in-play matches |
| GET | `/api/matches/[id]` | Match detail |
| GET | `/api/matches/[id]/stats` | Match statistics |
| GET | `/api/matches/[id]/tactics` | Tactical analysis (passing network, heatmap) |

### Competitions
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/competitions/[code]/matches` | All matches in a competition |
| GET | `/api/competitions/[code]/standings` | League table |
| GET | `/api/competitions/[code]/teams` | Teams in competition |

### Players
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/persons` | Search players (`?query=salah`) |
| GET | `/api/persons/[id]` | Player profile + stats |
| GET | `/api/persons/[id]/form` | Form trend (last N matches) |
| GET | `/api/persons/[id]/career` | Career statistics timeline |
| GET | `/api/persons/[id]/similar` | Similar players |
| GET | `/api/persons/compare` | Head-to-head comparison |

### Teams
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/teams/[id]` | Team profile |
| GET | `/api/teams/[id]/matches` | Team fixture list |
| GET | `/api/teams/[id]/scouting` | Opponent scouting report |

### Other
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/predictions/season` | Season finish predictions |
| GET | `/api/live/stream` | SSE stream for live updates |

---

## 🔌 WebSocket Events

Connected to `apps/realtime` (default `http://localhost:3001`).

```
Client emits:
  subscribe:match         { matchId }    – subscribe to a single match
  subscribe:live-scores                  – subscribe to all live matches

Server broadcasts:
  score:updated           { matchId, homeGoals, awayGoals, minute }
  match:<id>:event        { type, minute, team, player }
  player:stats:updated    { playerId, stats }
  notification:new        { message, type }
```

---

## 🐳 Docker

```bash
# Start infrastructure (PostgreSQL + Redis) — for local dev
docker compose up -d postgres redis

# Stop infrastructure
docker compose down

# Production — build and run the Compose services (web app, PostgreSQL, Redis)
docker compose up -d --build

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

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `5433` |
| Database | `POSTGRES_DB` from the root `.env` (default: `football`) |
| Username | `POSTGRES_USER` from the root `.env` (default: `postgres`) |
| Password | `POSTGRES_PASSWORD` from the root `.env` |

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
pnpm db:seed               # seed sample data
pnpm db:studio             # open Prisma Studio at localhost:5555

# Run a single app
pnpm --filter @app/web       dev
pnpm --filter @app/api       dev
pnpm --filter @app/realtime  dev
```

---

## 🚢 Deployment

### Vercel (Recommended for `apps/web`)

1. Push to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Set root directory to `apps/web`
4. Add all environment variables from `apps/web/.env`
5. Deploy automatically on every push to `main`

### Manual (all apps)

```bash
pnpm build
pnpm start
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m "feat: add my feature"`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request

---

## 📄 License

[MIT](LICENSE) © 2025

---

<div align="center">
  Built with ⚽ and lots of ☕
</div>
