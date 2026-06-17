// ─── socket/notification.socket.ts ───────────────────────────────────────────
// Đăng ký tất cả event liên quan đến thông báo cho 1 socket.
//
// Events client → server:
//   notification:subscribe   { matchId }        → theo dõi thông báo của trận
//   notification:unsubscribe { matchId }        → huỷ theo dõi
//   notification:get-subs    (không cần data)   → lấy danh sách trận đang theo dõi
//
// Events server → client:
//   notification:push        Notification       → thông báo mới (goal, card, v.v.)
//   notification:subscribed  { matchId, subs }  → xác nhận đăng ký
//   notification:subs-list   string[]           → danh sách matchId

import type { Server, Socket } from "socket.io";
import {
  handleSubscribe,
  handleUnsubscribe,
  handleGetSubscriptions,
  handleDisconnect,
} from "../handlers/notification.handler";

export function registerNotificationSocket(io: Server, socket: Socket): void {
  // userId fallback = socketId nếu user ẩn danh
  const userId = socket.user?.sub ?? socket.id;

  // ── Đăng ký nhận thông báo của 1 trận ────────────────────────────────────
  socket.on("notification:subscribe", ({ matchId }: { matchId: string }) => {
    const result = handleSubscribe(userId, matchId);

    // Vào room notification riêng cho user (để server có thể push trực tiếp)
    socket.join(`notify:${userId}`);

    const subs = handleGetSubscriptions(userId);
    socket.emit("notification:subscribed", { matchId, subs });

    if (io) {
      // io được giữ để dùng sau — không cần gửi gì thêm ở đây
      void result;
    }
  });

  // ── Huỷ theo dõi ──────────────────────────────────────────────────────────
  socket.on("notification:unsubscribe", ({ matchId }: { matchId: string }) => {
    handleUnsubscribe(userId, matchId);

    const subs = handleGetSubscriptions(userId);
    socket.emit("notification:subscribed", { matchId: null, subs });
  });

  // ── Lấy danh sách trận đang theo dõi ─────────────────────────────────────
  socket.on("notification:get-subs", () => {
    const subs = handleGetSubscriptions(userId);
    socket.emit("notification:subs-list", subs);
  });

  // ── Dọn dẹp khi disconnect ────────────────────────────────────────────────
  socket.on("disconnect", () => {
    handleDisconnect(userId);
  });
}
