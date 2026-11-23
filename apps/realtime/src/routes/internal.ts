import { Router } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { internalAuthMiddleware } from "../middleware/internalAuth";
import { upsertLiveScore } from "../service/match.service";

const goals = z.number().int().min(0).max(2_147_483_647);
const scoreUpdate = z.object({
  event: z.literal("score:updated"),
  data: z.object({
    matchId: z.union([z.string().regex(/^[a-z0-9_-]{1,64}$/i), z.number().int().positive()]),
    homeTeam: z.string().max(200).optional(),
    awayTeam: z.string().max(200).optional(),
    homeScore: goals,
    awayScore: goals,
    minute: z.number().int().min(0).max(130).nullish(),
    status: z.enum(["SCHEDULED", "LIVE", "HT", "FT"]),
    updatedAt: z.string().datetime().optional(),
  }),
});

export function createInternalRouter(io: Server): Router {
  const router = Router();

  router.post("/emit", internalAuthMiddleware, async (request, response) => {
    const payload = scoreUpdate.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: "Invalid score update" });
      return;
    }

    const { event, data } = payload.data;
    await upsertLiveScore(String(data.matchId), {
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      homeScore: data.homeScore,
      awayScore: data.awayScore,
      minute: data.minute ?? undefined,
      status: data.status,
    });
    io.emit(event, data);
    response.json({ ok: true });
  });

  return router;
}
