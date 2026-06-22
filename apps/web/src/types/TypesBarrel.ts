// src/types/TypesBarrel.ts
// ── Shared app types (string IDs — safe for frontend + API layer) ──
export type {
  Match,
  Team,
  Player,
  Standing,
  League,
  MatchStatus,
  Position,
  FavType,
  User,
  Favorite,
} from '@app/types'

// ── Prisma-only types (used in server/DB code only) ──
export type {
  Role,
  MatchScore,
  MatchGoal,
  MatchStatistic,
  Side,
  Winner,
  Duration,
  TeamStats,
  PlayerStats,
  Prediction,
  PredResult,
  SyncLog,
  SyncStatus,
} from '@app/database'