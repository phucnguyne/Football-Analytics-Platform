// ─── handlers/player.handler.ts ───────────────────────────────────────────────
// Xử lý business logic cho các event liên quan đến cầu thủ.

import {
  getPlayerStats,
  getMatchPlayers,
  recordCard,
  updateRating,
  type CardEvent,
  type PlayerStats,
} from "../service/player.service";

// ── Lấy thống kê 1 cầu thủ trong trận ──────────────────────────────────────
export async function handleGetPlayerStats(
  matchId: string,
  playerId: string
): Promise<{ ok: true; data: PlayerStats } | { ok: false; error: string }> {
  const stats = await getPlayerStats(matchId, playerId);
  if (!stats) {
    return { ok: false, error: `Không tìm thấy cầu thủ ${playerId} trong trận ${matchId}` };
  }
  return { ok: true, data: stats };
}

// ── Lấy toàn bộ cầu thủ trong 1 trận ───────────────────────────────────────
export async function handleGetMatchLineup(matchId: string): Promise<PlayerStats[]> {
  return getMatchPlayers(matchId);
}

// ── Xử lý thẻ phạt ──────────────────────────────────────────────────────────
export async function handleCard(
  event: CardEvent
): Promise<{ ok: true; data: PlayerStats } | { ok: false; error: string }> {
  if (!event.matchId || !event.playerId || !event.cardType) {
    return { ok: false, error: "Dữ liệu thẻ phạt không hợp lệ" };
  }

  const updated = await recordCard(event);
  if (!updated) {
    return { ok: false, error: `Cầu thủ ${event.playerId} không tồn tại trong trận` };
  }

  return { ok: true, data: updated };
}

// ── Cập nhật rating cầu thủ ─────────────────────────────────────────────────
export async function handleUpdateRating(
  matchId: string,
  playerId: string,
  rating: number
): Promise<{ ok: true; data: PlayerStats } | { ok: false; error: string }> {
  if (rating < 0 || rating > 10) {
    return { ok: false, error: "Rating phải trong khoảng 0–10" };
  }

  const updated = await updateRating(matchId, playerId, rating);
  if (!updated) {
    return { ok: false, error: `Cầu thủ ${playerId} không tồn tại trong trận ${matchId}` };
  }

  return { ok: true, data: updated };
}
