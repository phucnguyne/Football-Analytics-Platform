// ─── handlers/notification.handler.ts ────────────────────────────────────────
// Xử lý logic đăng ký / huỷ đăng ký thông báo và tạo payload thông báo.

import {
  subscribe,
  unsubscribe,
  isSubscribed,
  buildNotification,
  getUserSubscriptions,
  clearSubscriptions,
  type NotificationType,
  type Notification,
} from "../service/notification.service";

// ── Đăng ký theo dõi trận đấu ───────────────────────────────────────────────
export function handleSubscribe(
  userId: string,
  matchId: string
): { ok: true; message: string } {
  subscribe(userId, matchId);
  return { ok: true, message: `Đã theo dõi trận ${matchId}` };
}

// ── Huỷ theo dõi trận đấu ───────────────────────────────────────────────────
export function handleUnsubscribe(
  userId: string,
  matchId: string
): { ok: true; message: string } {
  unsubscribe(userId, matchId);
  return { ok: true, message: `Đã huỷ theo dõi trận ${matchId}` };
}

// ── Lấy danh sách trận đang theo dõi ────────────────────────────────────────
export function handleGetSubscriptions(userId: string): string[] {
  return getUserSubscriptions(userId);
}

// ── Tạo payload thông báo để broadcast ──────────────────────────────────────
export function buildMatchNotification(
  type: NotificationType,
  matchId: string,
  detail: string
): Notification {
  const titles: Record<NotificationType, string> = {
    GOAL: "⚽ Bàn thắng!",
    CARD: "🟨 Thẻ phạt",
    MATCH_START: "🏟️ Trận đấu bắt đầu",
    MATCH_END: "🏁 Kết thúc trận",
    HALF_TIME: "⏸️ Nghỉ giữa hiệp",
    SYSTEM: "🔔 Thông báo hệ thống",
  };

  return buildNotification(type, {
    title: titles[type],
    body: detail,
    matchId,
  });
}

// ── Kiểm tra user có cần nhận thông báo của trận này không ──────────────────
export function shouldNotify(userId: string, matchId: string): boolean {
  return isSubscribed(userId, matchId);
}

// ── Dọn dẹp khi user disconnect ─────────────────────────────────────────────
export function handleDisconnect(userId: string): void {
  clearSubscriptions(userId);
}
