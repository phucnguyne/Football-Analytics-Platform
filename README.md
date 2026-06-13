<div align="center">

# ⚽ Football Analytics Platform

**A production-ready fullstack web app for real-time football data,  
match analytics, and team/player statistics.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)](https://prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38BDF8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Live Demo](#) · [Installation Guide](INSTALLATION.md) · [API Docs](#api-reference)

</div>

---

## 📸 Features

| Feature | Description |
|---------|-------------|
| 🟢 **Live Scores** | Real-time score updates via WebSocket (Socket.io) |
| 📅 **Fixtures** | Full fixture calendar with filters by league & date |
| 📊 **Match Stats** | Shots, possession, cards, corners per match |
| 🏆 **Standings** | League table with promotion/relegation zones |
| 👥 **Teams** | Team profiles, squad lists, season statistics |
| ⭐ **Players** | Player search, profiles, career stats |
| 📈 **Analytics** | Charts & trend visualizations (Recharts) |
| 🔐 **Auth** | JWT-based register/login, user favorites |
| 🆓 **Free APIs** | Works with TheSportsDB (no key) or football-data.org |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              Browser  (Next.js 16 + React 19)        │
│   Tanstack Query  ·  Zustand  ·  Socket.io client    │
└───────────────────┬─────────────────────────────────┘
                    │ HTTPS + WebSocket
┌───────────────────▼─────────────────────────────────┐
│       Next.js App Router  (SSR + API Routes)         │
│  /app/api/*  ←→  lib/api.ts  ←→  External APIs      │
└──────┬────────────┬────────────────────────────────-─┘
       │            │
  ┌────▼────┐  ┌────▼────┐
  │ Prisma  │  │  Redis  │   (optional caching)
  │  ORM   │  │  cache  │
  └────┬────┘  └─────────┘
       │
  ┌────▼────────┐
  │ PostgreSQL  │
  └─────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 16 | App framework (SSR, App Router, Turbopack) |
| React | 19 | UI library |
| TypeScript | 5.4 | Type safety |
| Tailwind CSS | 3.4 | Styling |
| Radix UI | latest | Accessible headless components |
| Zustand | 4.5 | Client state management |
| Tanstack Query | 5 | Server state & data fetching |
| Recharts | 2 | Data visualization charts |
| Socket.io-client | 4.7 | Real-time WebSocket updates |

### Backend
| Tool | Version | Purpose |
|------|---------|---------|
| Next.js API Routes | 16 | REST API endpoints |
| Prisma | 5 | Type-safe ORM |
| PostgreSQL | 16 | Primary database |
| NextAuth.js | 4 | Authentication |
| Socket.io | 4.7 | WebSocket server |

### DevOps
| Tool | Purpose |
|------|---------|
| Docker + Compose | Local dev environment |
| GitHub Actions | CI/CD pipeline |
| Vercel | Production deployment |

---

## 📁 Project Structure

```
football-analytics/
│
├── apps/web/                        # Next.js 16 application
│   ├── src/
│   │   ├── app/                     # App Router pages & API routes
│   │   │   ├── layout.tsx           # Root layout (fonts, metadata)
│   │   │   ├── page.tsx             # Home / landing page
│   │   │   ├── providers.tsx        # QueryClient + global providers
│   │   │   ├── matches/             # Matches listing + detail
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── teams/               # Teams grid + team detail
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── players/             # Player search + profile
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── standings/page.tsx   # League standings table
│   │   │   ├── analytics/page.tsx   # Charts & trends
│   │   │   ├── dashboard/page.tsx   # User dashboard (auth required)
│   │   │   └── api/                 # API route handlers
│   │   │       ├── matches/
│   │   │       │   ├── route.ts     # GET /api/matches
│   │   │       │   └── [id]/route.ts
│   │   │       ├── teams/
│   │   │       │   ├── route.ts     # GET /api/teams
│   │   │       │   └── [id]/route.ts
│   │   │       ├── players/
│   │   │       │   ├── route.ts     # GET /api/players
│   │   │       │   └── [id]/route.ts
│   │   │       ├── standings/route.ts
│   │   │       └── socket/route.ts  # WebSocket handler
│   │   │
│   │   ├── components/
│   │   │   ├── layouts/
│   │   │   │   └── Navbar.tsx       # Sticky nav with active states
│   │   │   ├── matches/
│   │   │   │   ├── MatchCard.tsx    # Score card with live badge
│   │   │   │   ├── MatchList.tsx    # Filterable match list
│   │   │   │   └── MatchStats.tsx   # Stat bars for a match
│   │   │   ├── teams/
│   │   │   │   ├── TeamCard.tsx
│   │   │   │   └── TeamSquad.tsx
│   │   │   ├── players/
│   │   │   │   ├── PlayerCard.tsx
│   │   │   │   └── PlayerSearch.tsx
│   │   │   ├── standings/
│   │   │   │   └── StandingsTable.tsx
│   │   │   └── ui/                  # Shared primitives
│   │   │       ├── Badge.tsx        # StatusBadge (LIVE, FT, …)
│   │   │       ├── Spinner.tsx
│   │   │       └── ErrorMessage.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts               # Unified football API client
│   │   │   ├── db.ts                # Prisma singleton
│   │   │   ├── socket.ts            # Socket.io client helpers
│   │   │   └── utils.ts             # cn(), formatDate(), …
│   │   │
│   │   ├── hooks/
│   │   │   ├── useMatches.ts        # React Query hooks
│   │   │   ├── useTeams.ts
│   │   │   ├── usePlayers.ts
│   │   │   ├── useStandings.ts
│   │   │   └── useWebSocket.ts      # Socket.io hooks
│   │   │
│   │   ├── store/
│   │   │   └── index.ts             # Zustand: UI + Live + User stores
│   │   │
│   │   ├── types/
│   │   │   └── index.ts             # All shared TypeScript interfaces
│   │   │
│   │   ├── config/
│   │   │   └── leagues.ts           # League IDs + metadata
│   │   │
│   │   └── styles/
│   │       └── globals.css          # Tailwind + CSS variables
│   │
│   ├── prisma/
│   │   ├── schema.prisma            # Full database schema
│   │   └── migrations/
│   │
│   ├── public/
│   │   ├── icons/
│   │   └── images/
│   │
│   ├── .env.example                 # All environment variables
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── docker/
│   └── Dockerfile                   # Multi-stage production image
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Lint → Test → Build
│       └── deploy.yml               # Auto-deploy to Vercel on main
│
├── scripts/
│   └── setup.sh                     # One-command local setup
│
├── docker-compose.yml               # Postgres + Redis + App
├── package.json
├── .gitignore
├── README.md                        # ← you are here
└── INSTALLATION.md                  # Step-by-step setup guide
```

---

## 🆓 API Options (All Free)

The app ships with a unified client (`lib/api.ts`) that supports three providers.

| Provider | Key Needed | Limit | Best For |
|----------|-----------|-------|---------|
| **TheSportsDB** *(default)* | ❌ No | None | Development, demos |
| **football-data.org** | ✅ Yes (free) | 100 req/day | Production |
| **OpenLigaDB** | ❌ No | None | European leagues |

Switch provider by setting env vars — no code change required.

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/football-analytics.git
cd football-analytics

# 2. Enable pnpm (built into Node.js 20 via corepack)
corepack enable && corepack prepare pnpm@latest --activate

# 3. Run the one-command setup (installs deps, starts DB, runs migrations)
bash scripts/setup.sh

# 4. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

**Full setup instructions:** see [INSTALLATION.md](INSTALLATION.md)

---

## 📡 API Reference

All routes return `{ success: boolean, data: T, error?: string }`.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/matches` | List matches (filters: leagueId, status, dateFrom, dateTo) |
| GET | `/api/matches/:id` | Single match with stats |
| GET | `/api/teams` | List teams (filter: leagueId) |
| GET | `/api/teams/:id` | Team detail + squad |
| GET | `/api/players` | List players (filter: teamId) |
| GET | `/api/players/:id` | Player detail + stats |
| GET | `/api/standings` | League standings (filter: competition) |

---

## 🔌 WebSocket Events

```
Client emits:
  subscribe:live-scores          – all live matches
  subscribe:match  { matchId }   – single match events

Server broadcasts:
  score:updated   { matchId, homeGoals, awayGoals, minute }
  match:<id>:event { type, minute, team, player }
  standings:updated { competition, standings[] }
```

---

## 🧪 Testing

```bash
pnpm test               # run all tests
pnpm test:watch         # watch mode
pnpm test:coverage      # with coverage report
```

---

## 🐳 Docker

```bash
# Start all services (DB, Redis, App)
docker-compose up -d

# Rebuild after changes
docker-compose up -d --build

# Stop all
docker-compose down
```

---

## 🚢 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add environment variables
4. Deploy automatically on every push to `main`

### Manual
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