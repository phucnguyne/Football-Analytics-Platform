// ─── service/player.service.ts ────────────────────────────────────────────────
// Business logic cho cầu thủ: theo dõi thống kê live, sự kiện thẻ phạt.

export interface PlayerStats {
  playerId: string;
  name: string;
  matchId: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  rating: number; // 0–10
}

export interface CardEvent {
  matchId: string;
  playerId: string;
  playerName: string;
  cardType: "yellow" | "red";
  minute: number;
}

// In-memory store: `${matchId}:${playerId}` → PlayerStats
const statsStore = new Map<string, PlayerStats>();

function key(matchId: string, playerId: string): string {
  return `${matchId}:${playerId}`;
}

// ── Lấy thống kê 1 cầu thủ trong 1 trận ────────────────────────────────────
export async function getPlayerStats(
  matchId: string,
  playerId: string
): Promise<PlayerStats | null> {
  return statsStore.get(key(matchId, playerId)) ?? null;
}

// ── Lấy toàn bộ cầu thủ trong 1 trận ───────────────────────────────────────
export async function getMatchPlayers(matchId: string): Promise<PlayerStats[]> {
  const result: PlayerStats[] = [];
  for (const [k, v] of statsStore) {
    if (k.startsWith(`${matchId}:`)) result.push(v);
  }
  return result;
}

// ── Ghi nhận thẻ phạt ───────────────────────────────────────────────────────
export async function recordCard(event: CardEvent): Promise<PlayerStats | null> {
  const k = key(event.matchId, event.playerId);
  const stats = statsStore.get(k);
  if (!stats) return null;

  if (event.cardType === "yellow") {
    stats.yellowCards += 1;
  } else {
    stats.redCards += 1;
  }

  statsStore.set(k, stats);
  return stats;
}

// ── Cập nhật rating thời gian thực ──────────────────────────────────────────
export async function updateRating(
  matchId: string,
  playerId: string,
  rating: number
): Promise<PlayerStats | null> {
  const k = key(matchId, playerId);
  const stats = statsStore.get(k);
  if (!stats) return null;

  stats.rating = Math.min(10, Math.max(0, rating));
  statsStore.set(k, stats);
  return stats;
}
