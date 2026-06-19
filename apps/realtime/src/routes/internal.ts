// ─── routes/internal.ts ───────────────────────────────────────────────────────
// Route HTTP nội bộ, KHÔNG dành cho client (browser). Chỉ service `api`
// (Fastify, port 3001) gọi sang để báo realtime server broadcast 1 event.
//
// POST /internal/emit
// Headers: x-internal-secret: <INTERNAL_SERVICE_SECRET>
// Body:    { event: string, room?: string, data: unknown }
//
// Nếu payload có dạng live-score (matchId + homeScore/awayScore...),
// đồng bộ luôn vào in-memory cache của match.service để các client
// join room sau đó (match:join) vẫn lấy được tỉ số mới nhất.

import { Router, type Request, type Response } from "express";
import type { Server } from "socket.io";
import { internalAuthMiddleware } from "../middleware/internalAuth";
import { upsertLiveScore } from "../service/match.service";

interface EmitBody {
  event: string;
  room?: string;
  data?: Record<string, unknown>;
}

function isLiveScorePayload(
  data: unknown
): data is { matchId: string } & Record<string, unknown> {
  return typeof data === "object" && data !== null && "matchId" in data;
}

export function createInternalRouter(io: Server): Router {
  const router = Router();

  router.post("/emit", internalAuthMiddleware, async (req: Request, res: Response) => {
    const { event, room, data } = req.body as EmitBody;

    if (!event || typeof event !== "string") {
      res.status(400).json({ error: "Missing or invalid 'event'" });
      return;
    }

    // Nếu là sự kiện liên quan tới tỉ số trận đấu, đồng bộ cache trước khi emit
    // để các client join room sau thời điểm này vẫn nhận được dữ liệu đúng.
    if (event === "score:updated" && isLiveScorePayload(data)) {
      await upsertLiveScore(data.matchId, {
        homeTeam: data.homeTeam as string | undefined,
        awayTeam: data.awayTeam as string | undefined,
        homeScore: data.homeScore as number | undefined,
        awayScore: data.awayScore as number | undefined,
        minute: data.minute as number | undefined,
        status: data.status as "SCHEDULED" | "LIVE" | "HT" | "FT" | undefined,
      });
    }

    if (room) {
      io.to(room).emit(event, data);
    } else {
      io.emit(event, data);
    }

    res.status(200).json({ ok: true });
  });

  return router;
}