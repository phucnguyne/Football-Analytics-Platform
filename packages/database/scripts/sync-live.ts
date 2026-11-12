import "dotenv/config";
import { env, getFootballDataEnv } from "@app/config";
import {
  PrismaClient,
  MatchStatus,
  Winner,
  Duration,
  EventType,
  Side,
} from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: env.DATABASE_URL },
  },
});

const { FOOTBALL_DATA_API_KEY: API_KEY, FOOTBALL_DATA_API_URL: API_URL } =
  getFootballDataEnv();

const headers = { "X-Auth-Token": API_KEY };

const realtimeUrl = process.env.REALTIME_INTERNAL_URL?.replace(/\/$/, "");
const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET;

if (
  env.NODE_ENV === "production" &&
  (!realtimeUrl || !internalServiceSecret || internalServiceSecret.length < 32)
) {
  throw new Error(
    "REALTIME_INTERNAL_URL and an INTERNAL_SERVICE_SECRET of at least 32 characters are required for the live-sync worker",
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

const STATUS_MAP: Record<string, MatchStatus> = {
  SCHEDULED: "SCHEDULED",
  TIMED: "TIMED",
  IN_PLAY: "IN_PLAY",
  PAUSED: "PAUSED",
  FINISHED: "FINISHED",
  POSTPONED: "POSTPONED",
  CANCELLED: "CANCELLED",
  SUSPENDED: "SUSPENDED",
};

function mapWinner(w: string | null): Winner | null {
  if (w === "HOME_TEAM") return "HOME";
  if (w === "AWAY_TEAM") return "AWAY";
  if (w === "DRAW") return "DRAW";
  return null;
}

function mapDuration(d: string | null): Duration | null {
  if (d === "REGULAR") return "REGULAR";
  if (d === "EXTRA_TIME") return "EXTRA_TIME";
  if (d === "PENALTY_SHOOTOUT") return "PENALTY";
  return null;
}

function mapGoalType(t: string | null): EventType {
  if (t === "OWN") return "OWN_GOAL";
  if (t === "PENALTY") return "PENALTY_GOAL";
  return "GOAL";
}

function mapCardType(c: string | null): EventType {
  if (c === "RED" || c === "RED_CARD") return "RED_CARD";
  if (c === "SECOND_YELLOW") return "SECOND_YELLOW";
  return "YELLOW_CARD";
}

function toRealtimeStatus(
  status: MatchStatus,
): "SCHEDULED" | "LIVE" | "HT" | "FT" {
  if (status === "IN_PLAY") return "LIVE";
  if (status === "PAUSED") return "HT";
  if (status === "FINISHED") return "FT";
  return "SCHEDULED";
}

async function notifyRealtime(data: {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: "SCHEDULED" | "LIVE" | "HT" | "FT";
}) {
  if (!realtimeUrl || !internalServiceSecret) return;

  try {
    const response = await fetch(`${realtimeUrl}/internal/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalServiceSecret,
      },
      body: JSON.stringify({ event: "score:updated", data }),
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) {
      console.warn(
        `  Realtime notification failed: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    // The database remains the source of truth; the next worker cycle retries the cache/broadcast.
    console.warn("  Could not notify realtime service:", error);
  }
}

async function fetchMatchDetails(matchId: number) {
  console.log(`  Fetching details for match ${matchId}...`);
  const res = await fetch(`${API_URL}/matches/${matchId}`, { headers });
  if (!res.ok) {
    console.warn(`  Failed to fetch match ${matchId}: ${res.statusText}`);
    return null;
  }
  return res.json();
}

async function saveMatchEvents(matchId: number, homeTeamId: number, data: any) {
  const events: {
    matchId: number;
    type: EventType;
    minute: number;
    minuteExtra: number | null;
    team: Side;
    playerId: number | null;
    relatedPlayerId: number | null;
    detail: string | null;
  }[] = [];

  // Goals
  if (data.goals) {
    for (const g of data.goals) {
      const side: Side = g.team?.id === homeTeamId ? "HOME" : "AWAY";
      events.push({
        matchId,
        type: mapGoalType(g.type),
        minute: g.minute ?? 0,
        minuteExtra: g.injuryTime ?? null,
        team: side,
        playerId: g.scorer?.id ?? null,
        relatedPlayerId: g.assist?.id ?? null,
        detail: g.scorer?.name ?? null,
      });
    }
  }

  // Bookings
  if (data.bookings) {
    for (const b of data.bookings) {
      const side: Side = b.team?.id === homeTeamId ? "HOME" : "AWAY";
      events.push({
        matchId,
        type: mapCardType(b.card),
        minute: b.minute ?? 0,
        minuteExtra: null,
        team: side,
        playerId: b.player?.id ?? null,
        relatedPlayerId: null,
        detail: b.player?.name ?? null,
      });
    }
  }

  // Substitutions
  if (data.substitutions) {
    for (const s of data.substitutions) {
      const side: Side = s.team?.id === homeTeamId ? "HOME" : "AWAY";
      events.push({
        matchId,
        type: "SUBSTITUTION",
        minute: s.minute ?? 0,
        minuteExtra: null,
        team: side,
        playerId: s.playerOut?.id ?? null,
        relatedPlayerId: s.playerIn?.id ?? null,
        detail: `${s.playerOut?.name ?? "?"} → ${s.playerIn?.name ?? "?"}`,
      });
    }
  }

  if (events.length > 0) {
    await prisma.matchEvent.deleteMany({ where: { matchId } });
    await prisma.matchEvent.createMany({ data: events });
    console.log(`  Saved ${events.length} events for match ${matchId}`);
  }
}

async function syncLiveMatches() {
  const startTime = Date.now();
  const today = todayISO();
  console.log(
    `\n[${new Date().toISOString()}] Starting live sync for ${today}...`,
  );

  // Create sync log
  const syncLog = await prisma.syncLog.create({
    data: {
      entity: "live-matches",
      status: "RUNNING",
      message: `Syncing matches for ${today}`,
    },
  });

  try {
    // Fetch today's matches from API
    console.log(`Fetching /matches?date=${today}...`);
    const res = await fetch(`${API_URL}/matches?date=${today}`, { headers });

    if (!res.ok) {
      throw new Error(`API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const apiMatches = data.matches ?? [];
    console.log(`Found ${apiMatches.length} matches for today`);

    let processed = 0;
    let detailsFetched = 0;

    for (const m of apiMatches) {
      // Check if this match exists in our DB
      const existing = await prisma.match.findUnique({
        where: { id: m.id },
        include: {
          events: { take: 1 },
          score: true,
          homeTeam: true,
          awayTeam: true,
        },
      });

      if (!existing) {
        console.log(`  Match ${m.id} not in DB, skipping`);
        continue;
      }

      const status = STATUS_MAP[m.status] ?? "SCHEDULED";
      const homeScore =
        m.score?.fullTime?.home ?? existing.score?.homeTeamGoals ?? 0;
      const awayScore =
        m.score?.fullTime?.away ?? existing.score?.awayTeamGoals ?? 0;
      const minute = m.minute ?? 0;
      const scoreChanged =
        existing.score?.homeTeamGoals !== homeScore ||
        existing.score?.awayTeamGoals !== awayScore;
      const statusChanged =
        existing.status !== status || existing.minute !== (m.minute ?? null);

      // Update match status
      await prisma.match.update({
        where: { id: m.id },
        data: {
          status,
          minute: m.minute ?? null,
          lastUpdated: new Date(),
        },
      });

      // Upsert score
      if (m.score && m.score.fullTime?.home !== null) {
        await prisma.matchScore.upsert({
          where: { matchId: m.id },
          update: {
            homeTeamGoals: m.score.fullTime?.home ?? 0,
            awayTeamGoals: m.score.fullTime?.away ?? 0,
            homeTeamGoalsHT: m.score.halfTime?.home,
            awayTeamGoalsHT: m.score.halfTime?.away,
            winner: mapWinner(m.score.winner),
            duration: mapDuration(m.score.duration),
          },
          create: {
            matchId: m.id,
            homeTeamGoals: m.score.fullTime?.home ?? 0,
            awayTeamGoals: m.score.fullTime?.away ?? 0,
            homeTeamGoalsHT: m.score.halfTime?.home,
            awayTeamGoalsHT: m.score.halfTime?.away,
            winner: mapWinner(m.score.winner),
            duration: mapDuration(m.score.duration),
          },
        });
      }

      // Keep Redis and Socket.IO in sync after the DB transaction has committed. We
      // also publish every active match once per cycle so a restarted realtime
      // service repopulates its cache without a manual intervention.
      if (
        scoreChanged ||
        statusChanged ||
        status === "IN_PLAY" ||
        status === "PAUSED"
      ) {
        await notifyRealtime({
          matchId: String(m.id),
          homeTeam: existing.homeTeam.name,
          awayTeam: existing.awayTeam.name,
          homeScore,
          awayScore,
          minute,
          status: toRealtimeStatus(status),
        });
      }

      // If FINISHED and no events saved yet, fetch details
      if (status === "FINISHED" && existing.events.length === 0) {
        // Rate limit: wait 1.5s between detail fetches (10 req/min limit)
        await sleep(1500);
        const detail = await fetchMatchDetails(m.id);
        if (detail) {
          await saveMatchEvents(m.id, existing.homeTeamId, detail);
          // Save raw data
          await prisma.match.update({
            where: { id: m.id },
            data: { rawData: detail },
          });
          detailsFetched++;
        }
      }

      processed++;
    }

    const durationMs = Date.now() - startTime;

    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "SUCCESS",
        itemCount: processed,
        endTime: new Date(),
        durationMs,
        message: `Synced ${processed} matches, fetched ${detailsFetched} details`,
      },
    });

    console.log(
      `\nSync complete! ${processed} matches processed, ${detailsFetched} details fetched (${durationMs}ms)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Sync failed:", msg);

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        endTime: new Date(),
        durationMs: Date.now() - startTime,
        message: msg,
      },
    });
    process.exitCode = 1;
  }
}

const watch = process.argv.includes("--watch");

async function run() {
  do {
    await syncLiveMatches();
    if (watch) await sleep(60_000);
  } while (watch);
}

run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
