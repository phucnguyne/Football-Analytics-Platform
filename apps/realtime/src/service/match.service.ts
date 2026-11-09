// ─── service/match.service.ts ─────────────────────────────────────────────────
// Business logic cho trận đấu: lấy dữ liệu, cập nhật tỉ số, quản lý phòng.
// Tầng này KHÔNG biết Socket.io tồn tại — chỉ làm việc với dữ liệu thuần.

import { getRedisClient } from "../config/redis";

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

const LIVE_SCORE_PREFIX = "realtime:live-score:";
const LIVE_SCORE_IDS_KEY = "realtime:live-score:ids";
const liveScoreCache = new Map<string, LiveScore>();

const UPSERT_LIVE_SCORE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local score
if raw then
  score = cjson.decode(raw)
else
  score = {
    homeTeam = 'Home',
    awayTeam = 'Away',
    homeScore = 0,
    awayScore = 0,
    minute = 0,
    status = 'LIVE'
  }
end
local patch = cjson.decode(ARGV[1])
for key, value in pairs(patch) do
  score[key] = value
end
score.matchId = ARGV[2]
score.updatedAt = ARGV[3]
local encoded = cjson.encode(score)
redis.call('SET', KEYS[1], encoded)
if score.status == 'LIVE' or score.status == 'HT' then
  redis.call('SADD', KEYS[2], ARGV[2])
else
  redis.call('SREM', KEYS[2], ARGV[2])
end
return encoded
`;

const UPDATE_LIVE_SCORE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return false
end
local score = cjson.decode(raw)
if ARGV[1] == 'goal' then
  local field = ARGV[2] == 'home' and 'homeScore' or 'awayScore'
  score[field] = score[field] + 1
  score.minute = tonumber(ARGV[3])
else
  score.status = ARGV[2]
  score.minute = tonumber(ARGV[3])
end
score.updatedAt = ARGV[4]
local encoded = cjson.encode(score)
redis.call('SET', KEYS[1], encoded)
if score.status == 'LIVE' or score.status == 'HT' then
  redis.call('SADD', KEYS[2], score.matchId)
else
  redis.call('SREM', KEYS[2], score.matchId)
end
return encoded
`;

function scoreKey(matchId: string): string {
  return `${LIVE_SCORE_PREFIX}${matchId}`;
}

function decodeLiveScore(raw: string): LiveScore {
  const score = JSON.parse(raw) as Omit<LiveScore, "updatedAt"> & {
    updatedAt: string;
  };
  return { ...score, updatedAt: new Date(score.updatedAt) };
}

function readScriptScore(result: unknown): LiveScore | null {
  if (result === null || result === false) return null;
  if (typeof result !== "string") {
    throw new Error("Redis returned an invalid live-score response");
  }
  return decodeLiveScore(result);
}

// ── Lấy tỉ số hiện tại của 1 trận ──────────────────────────────────────────
export async function getLiveScore(matchId: string): Promise<LiveScore | null> {
  const redis = getRedisClient();
  if (redis) {
    const raw = await redis.get(scoreKey(matchId));
    return raw ? decodeLiveScore(raw) : null;
  }
  return liveScoreCache.get(matchId) ?? null;
}

// ── Lấy tất cả trận đang diễn ra ───────────────────────────────────────────
export async function getAllLiveScores(): Promise<LiveScore[]> {
  const redis = getRedisClient();
  if (redis) {
    const matchIds = await redis.sMembers(LIVE_SCORE_IDS_KEY);
    if (matchIds.length === 0) return [];
    const scores = await redis.mGet(matchIds.map(scoreKey));
    return scores
      .filter((score): score is string => score !== null)
      .map(decodeLiveScore)
      .filter((match) => match.status === "LIVE" || match.status === "HT");
  }
  return Array.from(liveScoreCache.values()).filter(
    (m) => m.status === "LIVE" || m.status === "HT",
  );
}

// ── Cập nhật tỉ số sau khi có bàn thắng ────────────────────────────────────
export async function recordGoal(event: GoalEvent): Promise<LiveScore | null> {
  const redis = getRedisClient();
  if (redis) {
    const result = await redis.eval(UPDATE_LIVE_SCORE_SCRIPT, {
      keys: [scoreKey(event.matchId), LIVE_SCORE_IDS_KEY],
      arguments: [
        "goal",
        event.team,
        String(event.minute),
        new Date().toISOString(),
      ],
    });
    return readScriptScore(result);
  }

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
  minute: number,
): Promise<LiveScore | null> {
  const redis = getRedisClient();
  if (redis) {
    const result = await redis.eval(UPDATE_LIVE_SCORE_SCRIPT, {
      keys: [scoreKey(matchId), LIVE_SCORE_IDS_KEY],
      arguments: ["status", status, String(minute), new Date().toISOString()],
    });
    return readScriptScore(result);
  }

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
  data: Partial<Omit<LiveScore, "matchId">>,
): Promise<LiveScore> {
  const redis = getRedisClient();
  if (redis) {
    const result = await redis.eval(UPSERT_LIVE_SCORE_SCRIPT, {
      keys: [scoreKey(matchId), LIVE_SCORE_IDS_KEY],
      arguments: [JSON.stringify(data), matchId, new Date().toISOString()],
    });
    const score = readScriptScore(result);
    if (!score)
      throw new Error(`Redis failed to upsert live score for match ${matchId}`);
    return score;
  }

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
export async function seedDemoMatch(): Promise<void> {
  await upsertLiveScore("match-001", {
    homeTeam: "Man City",
    awayTeam: "Arsenal",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    status: "SCHEDULED",
  });
}
