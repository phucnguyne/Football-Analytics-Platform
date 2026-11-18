# ⚽ Football Analytics Platform — Báo Cáo Rà Soát Toàn Diện

> **Ngày review:** 19/11/2026  
> **Phạm vi:** Toàn bộ monorepo (~200 files, 7 packages)  
> **Tech stack:** Next.js 16 · React 19 · TypeScript 5 · Prisma 5 · PostgreSQL · Supabase · Socket.IO · Redis

---

## 📋 1. Tổng Quan Project

| Thành phần | Mô tả |
|---|---|
| `apps/web` | Frontend Next.js 16 + API Routes (23 endpoints) |
| `apps/api` | Fastify 4 — internal live-scores service |
| `apps/realtime` | Express + Socket.IO realtime server |
| `packages/database` | Prisma ORM, schema, migrations, seed & sync scripts |
| `packages/config` | Shared env validation & config |
| `packages/types` | Shared TypeScript types |
| `packages/shared` | Validators, formatters, error helpers |

**Tổng quan:** Project có kiến trúc monorepo tốt, code tương đối sạch, nhưng có nhiều điểm cần cải thiện về type safety, performance, testing, và security.

---

## 🔴 2. Lỗi Cần Sửa Ngay (Critical)

### 2.1 TypeScript Build Errors

| # | File | Lỗi | Severity |
|---|---|---|---|
| 1 | `packages/database/scripts/seed-statsbomb.ts:57,71` | `TS2769` — Type `{ Authorization?: undefined }` không thể gán cho `HeadersInit`. Conditional header object tạo union type không hợp lệ | 🔴 |
| 2 | `supabase/functions/sync-live/index.ts:1,3-8,41` | `TS2304/TS2307` — `Deno` và `npm:@supabase/supabase-js@2` không được nhận dạng. Thiếu Deno type declarations | 🔴 |

**Cách sửa:**
```typescript
// seed-statsbomb.ts — sửa conditional header
const headers: Record<string, string> = token
  ? { Authorization: `token ${token}` }
  : {};
await fetch(url, { headers });

// sync-live/index.ts — thêm tsconfig riêng cho Supabase Edge Functions
// hoặc exclude khỏi root tsconfig
```

### 2.2 `ignoreBuildErrors: true` trong Next.js Config

| File | Vấn đề | Severity |
|---|---|---|
| `apps/web/next.config.ts:11` | `typescript.ignoreBuildErrors = true` — che giấu tất cả TS errors khi build production | 🔴 |

> ⚠️ **Đây là anti-pattern nghiêm trọng.** Bất kỳ lỗi type nào cũng sẽ được bỏ qua khi deploy, dẫn đến runtime errors trên production.

### 2.3 Thiếu `NEXTAUTH_SECRET` Validation Mạnh

| File | Vấn đề | Severity |
|---|---|---|
| `apps/web/src/app/api/auth/[...nextauth]/route.ts` | Không set `secret` explicitly trong `NextAuthOptions` — dựa hoàn toàn vào env variable | 🔴 |

**Cách sửa:** Thêm `secret: env.NEXTAUTH_SECRET` vào `authOptions`.

### 2.4 Không có Error Boundaries, Loading States, Not-Found Pages

| Thiếu | Impact | Severity |
|---|---|---|
| `apps/web/src/app/**/error.tsx` | 0 error boundary — unhandled errors crash toàn bộ page | 🔴 |
| `apps/web/src/app/**/loading.tsx` | 0 loading page — không có skeleton/spinner khi navigate | 🟡 |
| `apps/web/src/app/**/not-found.tsx` | 0 not-found page — 404 hiển thị Next.js default | 🟡 |

---

## 🟡 3. Cải Thiện Code Quality

### 3.1 Lạm Dụng `any` Type (40+ occurrences)

| File | Số lần `any` | Severity |
|---|---|---|
| `apps/web/src/lib/api.ts` | ~20 lần — hầu hết normalize functions dùng `any` | 🟡 |
| `apps/web/src/lib/player-analytics.ts:72,99,118` | 3 functions nhận `any` params | 🟡 |
| `apps/web/src/lib/db-helpers.ts:119-121` | `(e as any).xG/x/y` — unsafe cast | 🟡 |
| `apps/web/src/app/api/persons/route.ts:24` | `let providerData: any = null` | 🟡 |
| `apps/web/src/app/api/teams/[teamId]/route.ts:59,73` | `any` cho external data | 🟡 |
| `apps/web/src/app/api/teams/[teamId]/matches/route.ts:20` | `const where: any` | 🟡 |
| `apps/web/src/components/matches/MatchCard.tsx:81-93` | `(match as any).prediction` — 7 lần | 🟡 |
| `apps/web/src/lib/tactics-generator.ts:132-138` | `lineup?: any[]` | 🟡 |

**Recommendation:** Tạo interfaces/types cụ thể cho external API responses (football-data.org), loại bỏ hoàn toàn `any`.

### 3.2 Barrel Files — Không Nhất Quán

| File | Vấn đề |
|---|---|
| `apps/web/src/hooks/HooksBarrel.ts` | Re-export hooks — OK nhưng thiếu `useMatchLive` |
| `apps/web/src/store/StoreBarrel.ts` | Re-export stores — thiếu `useLiveStore` |
| `apps/web/src/types/TypesBarrel.ts` | Có barrel file nhưng không rõ nội dung |
| `apps/web/src/lib/utilsBarrel.ts` | Có barrel file nhưng không rõ nội dung |

### 3.3 TanStack Query — Thiếu Consistency

| Vấn đề | Files ảnh hưởng |
|---|---|
| Nhiều hooks thiếu `staleTime` → default 0 = refetch mỗi render | `useMatches`, `usePlayers`, `useLiveMatches` |
| Không có `placeholderData` cho UX mượt hơn | Tất cả hooks |
| `staleTime` inconsistent: 1min, 5min, 10min, 30min, 6h | Toàn bộ codebase |
| Default global `staleTime: 60 * 1000` nhưng nhiều component override | `query-provider.tsx:19` |

### 3.4 Homepage Dùng `'use client'` Không Cần Thiết

| File | Vấn đề | Severity |
|---|---|---|
| `apps/web/src/app/page.tsx` | Toàn bộ homepage là client component chỉ vì dùng `useQuery`. Có thể refactor thành Server Component + Client child | 🟡 |

### 3.5 Navigation Dùng `<a>` Thay Vì `<Link>`

| File | Vấn đề | Severity |
|---|---|---|
| `apps/web/src/app/layout.tsx` | 7 navigation links dùng raw `<a>` tags thay vì `next/link` → full page reload mỗi lần navigate, mất SPA behavior | 🟡 |

---

## ⚡ 4. Tối Ưu Performance

### 4.1 Không Dùng Dynamic Imports cho Heavy Libraries

| Vấn đề | Severity |
|---|---|
| **Recharts** (radar, area, bar charts) được import statically trong tất cả components → tăng bundle size đáng kể | 🟡 |
| **Không có `React.memo()`** — 0 component nào dùng memo. Các component như `MatchCard`, `ShotMap`, `PlayerRadarChart` nên được memo | 🟡 |
| **Không có `next/dynamic`** — 0 dynamic imports. Heavy components (ShotMap, PassingNetwork, PlayerHeatmap, MomentumGraph) nên lazy load | 🟡 |

**Cách sửa:**
```typescript
// Dynamic import cho heavy components
import dynamic from 'next/dynamic'
const ShotMap = dynamic(() => import('@/components/matches/ShotMap').then(m => ({ default: m.ShotMap })), {
  loading: () => <Skeleton className="h-96" />,
  ssr: false,
})
```

### 4.2 Database Performance — Thiếu Indexes

| Model/Field | Vấn đề | Severity |
|---|---|---|
| `Match.status` | Nhiều query filter theo `status` nhưng **không có index** | 🔴 |
| `Match.utcDate` | Sort by `utcDate` phổ biến nhưng **không có index** | 🟡 |
| `Match.leagueId` | Filter theo league nhưng **không có index** | 🟡 |
| `Match.homeTeamId / awayTeamId` | Dùng trong joins nhưng **không có index riêng** | 🟡 |
| `MatchEvent.matchId` | Có `@@index([matchId])` ✅ | ✅ |
| `PlayerStats` | Chỉ có `@@unique([playerId])` — query by `seasonId` chậm | 🟡 |

**Cách sửa — thêm vào `schema.prisma`:**
```prisma
model Match {
  // ... existing fields
  @@index([status])
  @@index([utcDate])
  @@index([leagueId])
  @@index([homeTeamId])
  @@index([awayTeamId])
  @@index([status, utcDate])
}
```

### 4.3 N+1 Query Patterns

| File | Vấn đề | Severity |
|---|---|---|
| `apps/web/src/app/api/matches/[id]/route.ts:66-70` | Fetch 200 finished matches mỗi request để compute prediction — không cache | 🟡 |
| `apps/web/src/app/api/persons/route.ts` | Fetch team data, then squad, then match by name — multiple sequential DB + API calls | 🟡 |

### 4.4 Prisma Queries Thiếu `select`

| Vấn đề | Impact |
|---|---|
| Hầu hết queries dùng `include` (fetch full relation) thay vì `select` (chỉ lấy fields cần) | Over-fetching data, chậm hơn cần thiết |
| `apps/web/src/app/api/matches/[id]/route.ts:120-134` — include tất cả events, lineups, statistics cho 1 match | Có thể rất nặng cho match có nhiều events |

### 4.5 External API Calls Không Cache

| File | Vấn đề | Severity |
|---|---|---|
| `apps/web/src/app/api/matches/[id]/route.ts` | Fetch từ football-data.org mỗi request cho IN_PLAY matches, chỉ dùng `next: { revalidate: 30 }` | 🟡 |
| Nhiều API routes | Gọi football-data.org API không có retry, circuit breaker | 🟡 |

---

## 🔒 5. Bảo Mật (Security)

### 5.1 Authentication Issues

| # | Vấn đề | File | Severity |
|---|---|---|---|
| 1 | Error messages tiết lộ thông tin: `"User not found"` vs `"Invalid credentials"` — cho attacker biết email có tồn tại | `auth/[...nextauth]/route.ts:27` | 🟡 |
| 2 | Không có rate limiting trên login endpoint | Auth route | 🟡 |
| 3 | Không có account lockout sau N lần sai | Auth route | 🟢 |

**Cách sửa:** Trả message chung cho cả 2 trường hợp: `"Invalid email or password"`.

### 5.2 API Routes Không Có Auth Protection

| Route | Public? | Cần auth? | Severity |
|---|---|---|---|
| `/api/matches` | ✅ | Có thể để public | 🟢 |
| `/api/persons` | ✅ | Có thể để public | 🟢 |
| `/api/predictions/season` | ✅ | Nên yêu cầu auth (write data) | 🟡 |
| `/api/platform-stats` | ✅ | Nên protect (thông tin internal) | 🟡 |
| Tất cả API routes | ✅ | Không có middleware auth chung | 🟡 |

### 5.3 Supabase Client Exposure

| File | Vấn đề | Severity |
|---|---|---|
| `apps/web/src/lib/supabase-browser.ts` | Supabase `anon key` exposed client-side — bình thường nếu có RLS, nhưng **không thấy RLS policies** trong migrations | 🟡 |

### 5.4 API Key Exposure Risk

| File | Vấn đề | Severity |
|---|---|---|
| `apps/web/src/lib/env.ts` | `FOOTBALL_DATA_API_KEY` được validate đúng server-side ✅ | ✅ |
| `apps/web/src/lib/env.ts` | Có `server-only` import ✅ | ✅ |
| Docker compose | Env vars passed correctly ✅ | ✅ |

### 5.5 CORS Configuration

| App | Config | Severity |
|---|---|---|
| `apps/api` (Fastify) | CORS chỉ cho phép `WEB_APP_URL` ✅ | ✅ |
| `apps/realtime` | CORS set qua `env.webUrl` ✅ | ✅ |
| `apps/web` (Next.js) | Không có explicit CORS — để Next.js default | 🟢 |

---

## 🏗️ 6. Kiến Trúc & Cấu Trúc

### 6.1 Dual/Triple Backend — Complexity Không Cần Thiết

| Vấn đề | Chi tiết | Severity |
|---|---|---|
| 3 backend cùng tồn tại | Next.js API Routes + Fastify API + Express Realtime. README nói Fastify/Express chỉ cho "local/legacy VM" nhưng code vẫn maintained | 🟡 |
| **Recommendation:** | Nếu production dùng Vercel + Supabase, deprecate rõ ràng `apps/api` và `apps/realtime` hoặc tách thành package riêng | |

### 6.2 Data Layer Issues

| Vấn đề | Chi tiết | Severity |
|---|---|---|
| Mock data generators | `career-generator.ts`, `scouting-generator.ts`, `tactics-generator.ts` tạo dữ liệu giả deterministic bằng seeded PRNG. Frontend hiển thị mix real + fake data **mà user không biết** | 🟡 |
| **Recommendation:** | Đánh dấu rõ ràng data nào là "Generated" vs "Real" trên UI | |

### 6.3 Thiếu Abstraction Layer

| Vấn đề | Severity |
|---|---|
| API routes chứa cả business logic + data access + response formatting → vi phạm SRP | 🟡 |
| Nhiều route > 200 LOC (predictions: 405, standings: 273, persons: 260) | 🟡 |
| **Recommendation:** Tạo service layer riêng: `services/match.service.ts`, `services/player.service.ts` | |

---

## 🚀 7. Phát Triển Tính Năng Mới

### Ưu tiên cao (Impact lớn, effort vừa)

| # | Tính năng | Mô tả | Effort |
|---|---|---|---|
| 1 | 🧪 **Testing** | Hiện tại 0 test files. Thêm unit tests cho lib/, integration tests cho API routes, component tests | High |
| 2 | 🔍 **Global Search** | Search players, teams, matches từ header. Có sẵn query params trong `/api/persons` | Medium |
| 3 | 📱 **Responsive Navigation** | Header nav hiện chỉ horizontal — cần hamburger menu cho mobile | Low |
| 4 | 🏷️ **Data Source Labels** | Hiển thị rõ "Real Data" vs "Generated/Mock" trên mỗi component analytics | Low |
| 5 | ⚡ **Skeleton Loading** | Thêm `loading.tsx` cho mỗi route + skeleton components | Medium |

### Ưu tiên trung bình

| # | Tính năng | Mô tả | Effort |
|---|---|---|---|
| 6 | 📊 **Dashboard Page** | Trang tổng quan cá nhân: favorite teams, upcoming matches, recent predictions | High |
| 7 | 🔔 **Push Notifications** | Thông báo goal, kết quả match cho favorite teams (Service Worker + Web Push) | High |
| 8 | 🌐 **i18n** | Đa ngôn ngữ (ít nhất EN + VI) dùng `next-intl` | Medium |
| 9 | 📤 **Data Export** | Export standings, player stats dưới dạng CSV/PDF | Medium |
| 10 | 🏠 **PWA Support** | Service worker, offline cache, install prompt | Medium |

### Ưu tiên thấp (Nice-to-have)

| # | Tính năng | Mô tả |
|---|---|---|
| 11 | 💬 **Social Features** | Comments trên match pages, sharing predictions |
| 12 | 🤖 **AI Insights** | Dùng LLM generate match previews/reviews tự động |
| 13 | 📈 **Advanced xG Model** | Tự train xG model thay vì dùng mock data |
| 14 | 🗂️ **API Documentation** | OpenAPI/Swagger cho tất cả API routes |
| 15 | 🎨 **Theme Customization** | Cho phép user chọn team colors làm theme |

---

## 🛠️ 8. DevOps & Infrastructure

### 8.1 CI/CD — Hoàn Toàn Thiếu

| Vấn đề | Severity |
|---|---|
| **Không có `.github/workflows/`** — không CI/CD pipeline | 🔴 |
| Không có automated testing, linting, type-checking trước deploy | 🔴 |
| Không có branch protection rules | 🟡 |

**Recommendation — tạo `.github/workflows/ci.yml`:**
```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm type-check
      - run: pnpm build
      - run: pnpm test
```

### 8.2 Linting — Broken

| Vấn đề | File | Severity |
|---|---|---|
| README ghi: "web lint script uses `next lint`, which is unsupported by the current Next.js CLI" | `apps/web/package.json` | 🟡 |
| Không có ESLint config file (`.eslintrc*`, `eslint.config*`) | Root | 🟡 |
| **Recommendation:** Migrate sang `eslint.config.mjs` with flat config | |

### 8.3 Testing — Chưa Setup

| Vấn đề | Severity |
|---|---|
| `package.json` có `jest`, `ts-jest`, `@testing-library/*` nhưng **0 test files** | 🟡 |
| Không có `jest.config.*` file | 🟡 |
| **Recommendation:** Tạo `jest.config.ts` và bắt đầu với unit tests cho `lib/` functions | |

### 8.4 Docker — Tốt Nhưng Có Thể Cải Thiện

| Điểm | Đánh giá |
|---|---|
| Multi-stage build ✅ | Tốt |
| Non-root user (`nextjs:nodejs`) ✅ | Tốt |
| `.dockerignore` | ⚠️ Chưa kiểm tra — cần verify |
| Health checks trên postgres, redis ✅ | Tốt |
| Ports bind `127.0.0.1` ✅ | Tốt — không expose ra ngoài |

### 8.5 Monitoring & Logging

| Vấn đề | Severity |
|---|---|
| Health endpoint chỉ check liveness, không check DB connectivity | 🟡 |
| Logging chỉ dùng `console.log/error/warn` — không structured logging | 🟡 |
| Không có error tracking (Sentry, etc.) | 🟡 |
| Không có APM (Application Performance Monitoring) | 🟢 |

---

## 📊 9. Tổng Kết & Roadmap

### Thống Kê Issues

| Severity | Số lượng |
|---|---|
| 🔴 Critical | 6 |
| 🟡 Medium | ~30 |
| 🟢 Low | ~10 |

### Roadmap Đề Xuất

#### 🏃 Sprint 1 — Critical Fixes (1 tuần)

- [ ] Sửa TypeScript errors (seed-statsbomb.ts, sync-live/index.ts)
- [ ] Tắt `ignoreBuildErrors: true` trong next.config.ts
- [ ] Thêm `secret` vào NextAuth config
- [ ] Thêm database indexes cho `Match` model
- [ ] Thêm `error.tsx` error boundaries cho mỗi route
- [ ] Đổi `<a>` thành `<Link>` trong layout.tsx
- [ ] Setup CI/CD pipeline cơ bản

#### 🚶 Sprint 2 — Code Quality (1–2 tuần)

- [ ] Loại bỏ `any` types — tạo interfaces cho external API responses
- [ ] Thêm `loading.tsx` và `not-found.tsx` cho các routes
- [ ] Dynamic imports cho Recharts components
- [ ] Thêm `React.memo()` cho MatchCard, ShotMap, PlayerRadarChart
- [ ] Chuẩn hóa TanStack Query staleTime across codebase
- [ ] Setup ESLint flat config
- [ ] Tạo Jest config và viết unit tests đầu tiên

#### 🏃‍♂️ Sprint 3 — Features & Performance (2–3 tuần)

- [ ] Global search functionality
- [ ] Responsive mobile navigation
- [ ] Data source labels (Real vs Generated)
- [ ] Skeleton loading components
- [ ] Prisma `select` optimization cho heavy queries
- [ ] Service layer refactoring cho API routes lớn
- [ ] Structured logging (pino/winston)

#### 🚀 Sprint 4 — Advanced (3–4 tuần)

- [ ] Dashboard page cá nhân
- [ ] i18n support
- [ ] PWA setup
- [ ] API documentation (OpenAPI)
- [ ] Error tracking (Sentry)
- [ ] Comprehensive test coverage (>60%)

---

> 📝 **Ghi chú:** Báo cáo này dựa trên static code analysis. Một số vấn đề performance cần benchmark thực tế để xác nhận impact. Các security findings cần penetration testing chuyên sâu hơn.
