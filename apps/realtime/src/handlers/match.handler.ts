// ─── handlers/match.handler.ts ────────────────────────────────────────────────
// Xử lý business logic cho các event liên quan đến trận đấu.
// Handler KHÔNG emit trực tiếp — trả về data để socket layer emit.

import {
  getLiveScore,
  getAllLiveScores,
  recordGoal,
  updateMatchStatus,
  type GoalEvent,
  type LiveScore,
} from "../service/match.service";

// ── Lấy tỉ số 1 trận theo yêu cầu của client ────────────────────────────────
export async function handleGetScore(
  matchId: string
): Promise<{ ok: true; data: LiveScore } | { ok: false; error: string }> {
  const score = await getLiveScore(matchId);
  if (!score) return { ok: false, error: `Không tìm thấy trận: ${matchId}` };
  return { ok: true, data: score };
}

// ── Lấy tất cả trận đang diễn ra ────────────────────────────────────────────
export async function handleGetAllLiveScores(): Promise<LiveScore[]> {
  return getAllLiveScores();
}

// ── Xử lý bàn thắng — cập nhật cache rồi trả về dữ liệu mới ────────────────
export async function handleGoal(
  event: GoalEvent
): Promise<{ ok: true; data: LiveScore } | { ok: false; error: string }> {
  if (!event.matchId || !event.scorer || !event.team) {
    return { ok: false, error: "Dữ liệu bàn thắng không hợp lệ" };
  }

  const updated = await recordGoal(event);
  if (!updated) return { ok: false, error: `Trận ${event.matchId} không tồn tại` };

  return { ok: true, data: updated };
}

// ── Cập nhật trạng thái trận (LIVE / HT / FT) ──────────────────────────────
export async function handleStatusChange(
  matchId: string,
  status: LiveScore["status"],
  minute: number
): Promise<{ ok: true; data: LiveScore } | { ok: false; error: string }> {
  const updated = await updateMatchStatus(matchId, status, minute);
  if (!updated) return { ok: false, error: `Trận ${matchId} không tồn tại` };

  return { ok: true, data: updated };
}
