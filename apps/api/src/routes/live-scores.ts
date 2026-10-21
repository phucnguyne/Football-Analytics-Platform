import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { notifyRealtime } from "../lib/realtime-client.js";

// ── Validation schemas ────────────────────────────────────────────────────────

const updateScoreSchema = z.object({
  homeTeamGoals: z.number().int().min(0),
  awayTeamGoals: z.number().int().min(0),
  homeTeamGoalsHT: z.number().int().min(0).optional(),
  awayTeamGoalsHT: z.number().int().min(0).optional(),
  minute: z.number().int().min(0).max(130).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Common include block so every returned match is fully typed. */
const matchInclude = {
  homeTeam: { select: { id: true, name: true, shortName: true, crest: true } },
  awayTeam: { select: { id: true, name: true, shortName: true, crest: true } },
  score: true,
  events: { orderBy: { minute: "desc" as const }, take: 20 },
} as const;

// ── Routes ────────────────────────────────────────────────────────────────────

export async function liveScoresRoutes(app: FastifyInstance) {
  // GET /api/live-scores – list of currently live (IN_PLAY / PAUSED) matches
  app.get("/live-scores", async (_request, reply) => {
    const matches = await prisma.match.findMany({
      where: { status: { in: ["IN_PLAY", "PAUSED"] } },
      include: matchInclude,
      orderBy: [{ utcDate: "asc" }],
      take: 50,
    });
    return reply.send({ data: matches });
  });

  // GET /api/live-scores/:id – single match detail with recent events
  app.get<{ Params: { id: string } }>("/live-scores/:id", async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: "Invalid match id" });
    }

    const match = await prisma.match.findUnique({
      where: { id },
      include: matchInclude,
    });

    if (!match) {
      return reply.status(404).send({ error: "Match not found" });
    }
    return reply.send({ data: match });
  });

  // PATCH /api/live-scores/:id – update score → write to DB + notify realtime server
  app.patch<{ Params: { id: string } }>("/live-scores/:id", async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: "Invalid match id" });
    }

    const parsed = updateScoreSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.match.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Match not found" });
    }

    const { homeTeamGoals, awayTeamGoals, homeTeamGoalsHT, awayTeamGoalsHT, minute } =
      parsed.data;

    // Transition TIMED / SCHEDULED → IN_PLAY when score is first updated
    const newStatus =
      existing.status === "TIMED" || existing.status === "SCHEDULED"
        ? "IN_PLAY"
        : existing.status;

    const [updatedMatch] = await prisma.$transaction([
      prisma.match.update({
        where: { id },
        data: {
          status: newStatus,
          minute: minute ?? existing.minute,
        },
      }),
      // Upsert the MatchScore record (1-to-1 relation)
      prisma.matchScore.upsert({
        where: { matchId: id },
        create: {
          matchId: id,
          homeTeamGoals,
          awayTeamGoals,
          homeTeamGoalsHT,
          awayTeamGoalsHT,
        },
        update: {
          homeTeamGoals,
          awayTeamGoals,
          ...(homeTeamGoalsHT !== undefined && { homeTeamGoalsHT }),
          ...(awayTeamGoalsHT !== undefined && { awayTeamGoalsHT }),
        },
      }),
    ]);

    // Notify socket.io server to broadcast to clients in "live-scores" room
    await notifyRealtime({
      event: "score:updated",
      room: "live-scores",
      data: {
        matchId: updatedMatch.id,
        homeTeamGoals,
        awayTeamGoals,
        minute: minute ?? null,
        updatedAt: updatedMatch.updatedAt,
      },
    });

    return reply.send({ data: updatedMatch });
  });

  // PATCH /api/live-scores/:id/finish – mark a match as FINISHED
  app.patch<{ Params: { id: string } }>("/live-scores/:id/finish", async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: "Invalid match id" });
    }

    const existing = await prisma.match.findUnique({
      where: { id },
      include: { score: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Match not found" });
    }

    const updatedMatch = await prisma.match.update({
      where: { id },
      data: { status: "FINISHED" },
      include: { score: true },
    });

    await notifyRealtime({
      event: "score:updated",
      room: "live-scores",
      data: {
        matchId: updatedMatch.id,
        status: updatedMatch.status,
        homeTeamGoals: updatedMatch.score?.homeTeamGoals ?? null,
        awayTeamGoals: updatedMatch.score?.awayTeamGoals ?? null,
      },
    });

    return reply.send({ data: updatedMatch });
  });
}
