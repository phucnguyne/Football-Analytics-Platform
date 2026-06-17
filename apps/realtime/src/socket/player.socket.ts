// ─── socket/player.socket.ts ──────────────────────────────────────────────────
// Đăng ký tất cả event liên quan đến cầu thủ cho 1 socket.
//
// Events client → server:
//   player:get-stats   { matchId, playerId }    → thống kê 1 cầu thủ
//   player:get-lineup  { matchId }              → toàn đội hình
//   player:card        CardEvent                → ghi nhận thẻ phạt
//   player:rate        { matchId, playerId, rating } → cập nhật rating
//
// Events server → client:
//   player:stats       PlayerStats
//   player:lineup      PlayerStats[]
//   player:card-issued { event, stats }
//   player:rated       PlayerStats

import type { Server, Socket } from "socket.io";
import {
  handleGetPlayerStats,
  handleGetMatchLineup,
  handleCard,
  handleUpdateRating,
} from "../handlers/player.handler";
import { buildMatchNotification } from "../handlers/notification.handler";
import type { CardEvent } from "../service/player.service";

export function registerPlayerSocket(io: Server, socket: Socket): void {
  // ── Lấy thống kê 1 cầu thủ ────────────────────────────────────────────────
  socket.on(
    "player:get-stats",
    async ({ matchId, playerId }: { matchId: string; playerId: string }) => {
      const result = await handleGetPlayerStats(matchId, playerId);
      if (result.ok) {
        socket.emit("player:stats", result.data);
      } else {
        socket.emit("error", { code: "NOT_FOUND", message: result.error });
      }
    }
  );

  // ── Lấy đội hình đang thi đấu ─────────────────────────────────────────────
  socket.on("player:get-lineup", async ({ matchId }: { matchId: string }) => {
    const lineup = await handleGetMatchLineup(matchId);
    socket.emit("player:lineup", lineup);
  });

  // ── Ghi nhận thẻ phạt ─────────────────────────────────────────────────────
  socket.on("player:card", async (event: CardEvent) => {
    const result = await handleCard(event);
    if (!result.ok) {
      socket.emit("error", { code: "CARD_ERROR", message: result.error });
      return;
    }

    // Broadcast cho room của trận đấu đó
    io.to(`match:${event.matchId}`).emit("player:card-issued", {
      event,
      stats: result.data,
    });

    const cardLabel = event.cardType === "yellow" ? "🟨 Thẻ vàng" : "🟥 Thẻ đỏ";
    const notification = buildMatchNotification(
      "CARD",
      event.matchId,
      `${cardLabel} cho ${event.playerName} phút ${event.minute}`
    );
    io.to(`match:${event.matchId}`).emit("notification:push", notification);
  });

  // ── Cập nhật rating cầu thủ ───────────────────────────────────────────────
  socket.on(
    "player:rate",
    async ({
      matchId,
      playerId,
      rating,
    }: {
      matchId: string;
      playerId: string;
      rating: number;
    }) => {
      const result = await handleUpdateRating(matchId, playerId, rating);
      if (result.ok) {
        // Chỉ trả về cho client đã rate, không cần broadcast
        socket.emit("player:rated", result.data);
      } else {
        socket.emit("error", { code: "RATING_ERROR", message: result.error });
      }
    }
  );
}
