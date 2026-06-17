// ─── socket/match.socket.ts ───────────────────────────────────────────────────
// Đăng ký tất cả event liên quan đến trận đấu cho 1 socket.
// Tầng này CHỈ map event ↔ handler, KHÔNG chứa business logic.
//
// Events client → server:
//   match:join         { matchId }              → vào room theo dõi trận
//   match:leave        { matchId }              → rời room
//   match:get-score    { matchId }              → lấy tỉ số hiện tại
//   match:get-all-live (không cần data)         → lấy tất cả trận đang live
//
// Events server → client:
//   match:score        LiveScore                → cập nhật tỉ số
//   match:goal         { event, score }         → bàn thắng mới
//   match:status       LiveScore                → đổi trạng thái (LIVE/HT/FT)
//   error              { code, message }

import type { Server, Socket } from "socket.io";
import {
  handleGetScore,
  handleGetAllLiveScores,
  handleGoal,
  handleStatusChange,
} from "../handlers/match.handler";
import { buildMatchNotification } from "../handlers/notification.handler";
import type { GoalEvent, LiveScore } from "../service/match.service";

export function registerMatchSocket(io: Server, socket: Socket): void {
  // ── Vào room theo dõi 1 trận ──────────────────────────────────────────────
  socket.on("match:join", async ({ matchId }: { matchId: string }) => {
    await socket.join(`match:${matchId}`);

    // Gửi ngay tỉ số hiện tại khi vào phòng
    const result = await handleGetScore(matchId);
    if (result.ok) {
      socket.emit("match:score", result.data);
    }
  });

  // ── Rời room ───────────────────────────────────────────────────────────────
  socket.on("match:leave", async ({ matchId }: { matchId: string }) => {
    await socket.leave(`match:${matchId}`);
  });

  // ── Lấy tỉ số theo yêu cầu ────────────────────────────────────────────────
  socket.on("match:get-score", async ({ matchId }: { matchId: string }) => {
    const result = await handleGetScore(matchId);
    if (result.ok) {
      socket.emit("match:score", result.data);
    } else {
      socket.emit("error", { code: "NOT_FOUND", message: result.error });
    }
  });

  // ── Lấy tất cả trận đang diễn ra ──────────────────────────────────────────
  socket.on("match:get-all-live", async () => {
    const scores = await handleGetAllLiveScores();
    socket.emit("match:all-live", scores);
  });

  // ── Ghi nhận bàn thắng (từ backend admin hoặc data feed) ──────────────────
  socket.on("match:goal", async (event: GoalEvent) => {
    const result = await handleGoal(event);
    if (!result.ok) {
      socket.emit("error", { code: "GOAL_ERROR", message: result.error });
      return;
    }

    const updatedScore: LiveScore = result.data;

    // Broadcast cho tất cả client đang xem trận này
    io.to(`match:${event.matchId}`).emit("match:goal", {
      event,
      score: updatedScore,
    });
    io.to(`match:${event.matchId}`).emit("match:score", updatedScore);

    // Tạo và gửi thông báo bàn thắng
    const notification = buildMatchNotification(
      "GOAL",
      event.matchId,
      `${event.scorer} ghi bàn phút ${event.minute} (${updatedScore.homeScore}–${updatedScore.awayScore})`
    );
    io.to(`match:${event.matchId}`).emit("notification:push", notification);
  });

  // ── Cập nhật trạng thái trận ───────────────────────────────────────────────
  socket.on(
    "match:status-change",
    async ({
      matchId,
      status,
      minute,
    }: {
      matchId: string;
      status: LiveScore["status"];
      minute: number;
    }) => {
      const result = await handleStatusChange(matchId, status, minute);
      if (!result.ok) {
        socket.emit("error", { code: "STATUS_ERROR", message: result.error });
        return;
      }

      io.to(`match:${matchId}`).emit("match:status", result.data);

      // Gửi thông báo tương ứng với trạng thái
      const notifType =
        status === "LIVE" ? "MATCH_START"
        : status === "HT" ? "HALF_TIME"
        : status === "FT" ? "MATCH_END"
        : "SYSTEM";

      const notification = buildMatchNotification(notifType, matchId, `Phút ${minute}`);
      io.to(`match:${matchId}`).emit("notification:push", notification);
    }
  );
}
