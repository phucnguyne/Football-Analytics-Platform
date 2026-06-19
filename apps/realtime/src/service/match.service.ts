// ─── service/match.service.ts ─────────────────────────────────────────────────
// Business logic cho trận đấu: lấy dữ liệu, cập nhật tỉ số, quản lý phòng.
// Tầng này KHÔNG biết Socket.io tồn tại — chỉ làm việc với dữ liệu thuần.

export interface LiveScore {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: "SCHEDULED" | "LIVE" | "HT" | "FT";
  updatedAt: Date;
}

export interface GoalEvent {
  matchId: string;
  team: "home" | "away";
  scorer: string;
  minute: number;
}

// In-memory cache cho live scores (production: dùng Redis)
const liveScoreCache = new Map<string, LiveScore>();

// ── Lấy tỉ số hiện tại của 1 trận ──────────────────────────────────────────
export async function getLiveScore(matchId: string): Promise<LiveScore | null> {
  return liveScoreCache.get(matchId) ?? null;
}

// ── Lấy tất cả trận đang diễn ra ───────────────────────────────────────────
export async function getAllLiveScores(): Promise<LiveScore[]> {
  return Array.from(liveScoreCache.values()).filter(
    (m) => m.status === "LIVE" || m.status === "HT"
  );
}

// ── Cập nhật tỉ số sau khi có bàn thắng ────────────────────────────────────
export async function recordGoal(event: GoalEvent): Promise<LiveScore | null> {
  const match = liveScoreCache.get(event.matchId);
  if (!match) return null;

  if (event.team === "home") {
    match.homeScore += 1;
  } else {
    match.awayScore += 1;
  }

  match.minute = event.minute;
  match.updatedAt = new Date();
  liveScoreCache.set(event.matchId, match);

  return match;
}

// ── Cập nhật trạng thái trận đấu (LIVE / HT / FT) ─────────────────────────
export async function updateMatchStatus(
  matchId: string,
  status: LiveScore["status"],
  minute: number
): Promise<LiveScore | null> {
  const match = liveScoreCache.get(matchId);
  if (!match) return null;

  match.status = status;
  match.minute = minute;
  match.updatedAt = new Date();
  liveScoreCache.set(matchId, match);

  return match;
}

// ── Tạo hoặc cập nhật toàn bộ tỉ số (dùng khi nhận dữ liệu từ service `api`) ─
// Khác với recordGoal (chỉ +1 điểm), hàm này set thẳng giá trị mới nhất,
// vì nguồn sự thật (DB) đã nằm ở `api`, cache ở đây chỉ phục vụ broadcast.
export async function upsertLiveScore(
  matchId: string,
  data: Partial<Omit<LiveScore, "matchId">>
): Promise<LiveScore> {
  const existing = liveScoreCache.get(matchId);

  const merged: LiveScore = {
    matchId,
    homeTeam: data.homeTeam ?? existing?.homeTeam ?? "Home",
    awayTeam: data.awayTeam ?? existing?.awayTeam ?? "Away",
    homeScore: data.homeScore ?? existing?.homeScore ?? 0,
    awayScore: data.awayScore ?? existing?.awayScore ?? 0,
    minute: data.minute ?? existing?.minute ?? 0,
    status: data.status ?? existing?.status ?? "LIVE",
    updatedAt: new Date(),
  };

  liveScoreCache.set(matchId, merged);
  return merged;
}

// ── Seed 1 trận demo vào cache (dùng khi dev) ──────────────────────────────
export function seedDemoMatch(): void {
  liveScoreCache.set("match-001", {
    matchId: "match-001",
    homeTeam: "Man City",
    awayTeam: "Arsenal",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    status: "SCHEDULED",
    updatedAt: new Date(),
  });
}