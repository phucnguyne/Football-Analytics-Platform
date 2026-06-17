// ─── service/notification.service.ts ─────────────────────────────────────────
// Quản lý subscription và gửi thông báo cho user cụ thể hoặc broadcast.

export type NotificationType =
  | "GOAL"
  | "CARD"
  | "MATCH_START"
  | "MATCH_END"
  | "HALF_TIME"
  | "SYSTEM";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  matchId?: string;
  createdAt: Date;
}

// userId → Set<matchId> — user đang theo dõi các trận nào
const subscriptions = new Map<string, Set<string>>();

// ── Đăng ký theo dõi trận đấu ───────────────────────────────────────────────
export function subscribe(userId: string, matchId: string): void {
  if (!subscriptions.has(userId)) {
    subscriptions.set(userId, new Set());
  }
  subscriptions.get(userId)!.add(matchId);
}

// ── Huỷ theo dõi ────────────────────────────────────────────────────────────
export function unsubscribe(userId: string, matchId: string): void {
  subscriptions.get(userId)?.delete(matchId);
}

// ── Kiểm tra user có theo dõi trận này không ────────────────────────────────
export function isSubscribed(userId: string, matchId: string): boolean {
  return subscriptions.get(userId)?.has(matchId) ?? false;
}

// ── Tạo object Notification chuẩn ───────────────────────────────────────────
export function buildNotification(
  type: NotificationType,
  data: { title: string; body: string; matchId?: string }
): Notification {
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title: data.title,
    body: data.body,
    matchId: data.matchId,
    createdAt: new Date(),
  };
}

// ── Lấy danh sách matchId mà user đang theo dõi ─────────────────────────────
export function getUserSubscriptions(userId: string): string[] {
  return Array.from(subscriptions.get(userId) ?? []);
}

// ── Dọn dẹp khi user disconnect ─────────────────────────────────────────────
export function clearSubscriptions(userId: string): void {
  subscriptions.delete(userId);
}
