import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { notifyRealtime } from "../lib/realtime-client.js";

const updateScoreSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  minute: z.number().int().min(0).max(130).optional(),
  note: z.string().max(280).optional(),
});

const createMatchSchema = z.object({
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
});

export async function liveScoresRoutes(app: FastifyInstance) {
  // GET /api/live-scores - danh sách trận đang LIVE (và gần đây)
  app.get("/live-scores", async (request, reply) => {
    const matches = await prisma.match.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 50,
    });
    return reply.send({ data: matches });
  });

  // GET /api/live-scores/:id - chi tiết 1 trận + lịch sử điểm
  app.get<{ Params: { id: string } }>("/live-scores/:id", async (request, reply) => {
    const { id } = request.params;
    const match = await prisma.match.findUnique({
      where: { id },
      include: { scoreEvents: { orderBy: { createdAt: "desc" }, take: 20 } },
    });

    if (!match) {
      return reply.status(404).send({ error: "Match not found" });
    }
    return reply.send({ data: match });
  });

  // POST /api/live-scores - tạo trận mới
  app.post("/live-scores", async (request, reply) => {
    const parsed = createMatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const match = await prisma.match.create({
      data: {
        homeTeam: parsed.data.homeTeam,
        awayTeam: parsed.data.awayTeam,
      },
    });

    return reply.status(201).send({ data: match });
  });

  // PATCH /api/live-scores/:id - cập nhật tỉ số -> ghi DB + báo realtime server
  app.patch<{ Params: { id: string } }>("/live-scores/:id", async (request, reply) => {
    const { id } = request.params;
    const parsed = updateScoreSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.match.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Match not found" });
    }

    const { homeScore, awayScore, minute, note } = parsed.data;

    const [updatedMatch] = await prisma.$transaction([
      prisma.match.update({
        where: { id },
        data: {
          homeScore,
          awayScore,
          status: existing.status === "SCHEDULED" ? "LIVE" : existing.status,
          startedAt: existing.startedAt ?? new Date(),
        },
      }),
      prisma.scoreEvent.create({
        data: { matchId: id, homeScore, awayScore, minute, note },
      }),
    ]);

    // Báo cho socket.io server broadcast tới các client đang subscribe "live-scores"
    await notifyRealtime({
      event: "score:updated",
      room: "live-scores",
      data: {
        matchId: updatedMatch.id,
        homeTeam: updatedMatch.homeTeam,
        awayTeam: updatedMatch.awayTeam,
        homeScore: updatedMatch.homeScore,
        awayScore: updatedMatch.awayScore,
        minute: minute ?? null,
        updatedAt: updatedMatch.updatedAt,
      },
    });

    return reply.send({ data: updatedMatch });
  });

  // PATCH /api/live-scores/:id/finish - kết thúc trận
  app.patch<{ Params: { id: string } }>("/live-scores/:id/finish", async (request, reply) => {
    const { id } = request.params;

    const existing = await prisma.match.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Match not found" });
    }

    const updatedMatch = await prisma.match.update({
      where: { id },
      data: { status: "FINISHED", finishedAt: new Date() },
    });

    await notifyRealtime({
      event: "score:updated",
      room: "live-scores",
      data: {
        matchId: updatedMatch.id,
        status: updatedMatch.status,
        homeScore: updatedMatch.homeScore,
        awayScore: updatedMatch.awayScore,
      },
    });

    return reply.send({ data: updatedMatch });
  });
}
