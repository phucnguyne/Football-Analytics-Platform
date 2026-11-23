import type { Prisma } from "@app/database";

// Deliberately minimal response shape: API routes can use Prisma `select` rather
// than materialising every database column solely to serialize a match response.
type TeamResponseFields = {
  id: number;
  name: string;
  shortName: string;
  crest: string | null;
  founded: number | null;
  venue: string | null;
};

type MatchWithIncludes = {
  id: number;
  utcDate: Date;
  status: string;
  minute: number | null;
  matchday: number | null;
  stage: string | null;
  lastUpdated: Date | null;
  homeTeam: TeamResponseFields;
  awayTeam: TeamResponseFields;
  score: {
    winner: string | null;
    duration: string | null;
    homeTeamGoals: number;
    awayTeamGoals: number;
    homeTeamGoalsHT: number | null;
    awayTeamGoalsHT: number | null;
    scoreExtraTimeHome: number | null;
    scoreExtraTimeAway: number | null;
    scorePenaltyHome: number | null;
    scorePenaltyAway: number | null;
  } | null;
  league: { id: number; name: string; emblem: string | null };
  winProbHome: number | null;
  winProbDraw: number | null;
  winProbAway: number | null;
};

type MatchWithDetails = MatchWithIncludes & {
  homeTeamId: number;
  awayTeamId: number;
  rawData: Prisma.JsonValue | null;
  events: Array<{
    type: string;
    minute: number;
    minuteExtra: number | null;
    team: string;
    xG: number | null;
    x: number | null;
    y: number | null;
    player: { id: number; name: string } | null;
    relatedPlayer: { id: number; name: string } | null;
  }>;
  lineups: Array<{
    teamId: number;
    playerId: number;
    isStarter: boolean;
    position: string | null;
    shirtNumber: number | null;
    player: { id: number; name: string };
  }>;
};

type MatchEventWithCoordinates = MatchWithDetails["events"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Convert a Prisma Team row to football-data.org API shape */
export function toTeamResponse(t: TeamResponseFields) {
  return {
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    tla: t.shortName,
    crest: t.crest,
    founded: t.founded,
    venue: t.venue,
  };
}

/** Convert a Prisma Match (with includes) to football-data.org API shape */
export function toMatchResponse(m: MatchWithIncludes) {
  return {
    id: m.id,
    utcDate: m.utcDate.toISOString(),
    status: m.status,
    minute: m.minute ?? null,
    matchday: m.matchday,
    stage: m.stage,
    lastUpdated: m.lastUpdated?.toISOString() ?? null,
    homeTeam: toTeamResponse(m.homeTeam),
    awayTeam: toTeamResponse(m.awayTeam),
    score: m.score
      ? {
          winner:
            m.score.winner === "HOME"
              ? "HOME_TEAM"
              : m.score.winner === "AWAY"
                ? "AWAY_TEAM"
                : m.score.winner,
          duration:
            m.score.duration === "PENALTY"
              ? "PENALTY_SHOOTOUT"
              : m.score.duration,
          fullTime: {
            home: m.score.homeTeamGoals,
            away: m.score.awayTeamGoals,
          },
          halfTime: {
            home: m.score.homeTeamGoalsHT,
            away: m.score.awayTeamGoalsHT,
          },
          extraTime: {
            home: m.score.scoreExtraTimeHome,
            away: m.score.scoreExtraTimeAway,
          },
          penalties: {
            home: m.score.scorePenaltyHome,
            away: m.score.scorePenaltyAway,
          },
        }
      : {
          winner: null,
          duration: "REGULAR",
          fullTime: { home: null, away: null },
          halfTime: { home: null, away: null },
        },
    competition: {
      id: m.league.id,
      name: m.league.name,
      emblem: m.league.emblem,
    },
    // Only show prediction for upcoming matches — not for live/finished where score is real
    prediction:
      m.winProbHome != null &&
      (m.status === "SCHEDULED" || m.status === "TIMED")
        ? (() => {
            // Normalize: if stored as decimal (0–1) convert to percentage. Poisson lib returns % already.
            const h = m.winProbHome!;
            const factor = h <= 1 ? 100 : 1;
            return {
              homeWin: Math.round(h * factor * 10) / 10,
              draw: Math.round((m.winProbDraw ?? 0) * factor * 10) / 10,
              awayWin: Math.round((m.winProbAway ?? 0) * factor * 10) / 10,
            };
          })()
        : null,
  };
}

/** Convert a Prisma Match with full details to the football-data.org single-match shape */
export function toMatchDetailResponse(m: MatchWithDetails) {
  const base = toMatchResponse(m);
  const rawData = isRecord(m.rawData) ? m.rawData : {};
  const providerHomeTeam = isRecord(rawData.homeTeam) ? rawData.homeTeam : {};
  const providerAwayTeam = isRecord(rawData.awayTeam) ? rawData.awayTeam : {};
  const providerArray = (value: unknown) =>
    Array.isArray(value) ? value : null;

  // Build goals from MatchEvents of type GOAL/OWN_GOAL/PENALTY_GOAL
  const storedGoals = m.events
    .filter((e) => ["GOAL", "OWN_GOAL", "PENALTY_GOAL"].includes(e.type))
    .sort((a, b) => a.minute - b.minute)
    .map((event) => {
      const e = event as MatchEventWithCoordinates;
      return {
        minute: e.minute,
        injuryTime: e.minuteExtra ?? null,
        type:
          e.type === "OWN_GOAL"
            ? "OWN"
            : e.type === "PENALTY_GOAL"
              ? "PENALTY"
              : "REGULAR",
        team:
          e.team === "HOME"
            ? { id: m.homeTeam.id, name: m.homeTeam.name }
            : { id: m.awayTeam.id, name: m.awayTeam.name },
        scorer: e.player ? { id: e.player.id, name: e.player.name } : null,
        assist: e.relatedPlayer
          ? { id: e.relatedPlayer.id, name: e.relatedPlayer.name }
          : null,
        xG: e.xG ?? null,
        x: e.x ?? null,
        y: e.y ?? null,
      };
    });

  const goals = providerArray(rawData.goals) ?? storedGoals;
  // Legacy SHOT rows have no verified provenance; only provider shot data is exposed.
  const shots = providerArray(rawData.shots) ?? [];

  // Build bookings from YELLOW_CARD/SECOND_YELLOW/RED_CARD events
  const storedBookings = m.events
    .filter((e) =>
      ["YELLOW_CARD", "SECOND_YELLOW", "RED_CARD"].includes(e.type),
    )
    .sort((a, b) => a.minute - b.minute)
    .map((e) => ({
      minute: e.minute,
      team:
        e.team === "HOME"
          ? { id: m.homeTeam.id, name: m.homeTeam.name }
          : { id: m.awayTeam.id, name: m.awayTeam.name },
      player: e.player ? { id: e.player.id, name: e.player.name } : null,
      card:
        e.type === "SECOND_YELLOW"
          ? "SECOND_YELLOW"
          : e.type === "RED_CARD"
            ? "RED"
            : "YELLOW_CARD",
    }));

  // Build substitutions from SUBSTITUTION events
  const storedSubstitutions = m.events
    .filter((e) => e.type === "SUBSTITUTION")
    .sort((a, b) => a.minute - b.minute)
    .map((e) => ({
      minute: e.minute,
      team:
        e.team === "HOME"
          ? { id: m.homeTeam.id, name: m.homeTeam.name }
          : { id: m.awayTeam.id, name: m.awayTeam.name },
      playerOut: e.player ? { id: e.player.id, name: e.player.name } : null,
      playerIn: e.relatedPlayer
        ? { id: e.relatedPlayer.id, name: e.relatedPlayer.name }
        : null,
    }));

  const bookings = providerArray(rawData.bookings) ?? storedBookings;
  const substitutions =
    providerArray(rawData.substitutions) ?? storedSubstitutions;

  // Build lineups
  const homeLineup = m.lineups
    .filter((l) => l.teamId === m.homeTeamId)
    .map((l) => ({
      id: l.player.id,
      name: l.player.name,
      position: l.position,
      shirtNumber: l.shirtNumber,
    }));

  const awayLineup = m.lineups
    .filter((l) => l.teamId === m.awayTeamId)
    .map((l) => ({
      id: l.player.id,
      name: l.player.name,
      position: l.position,
      shirtNumber: l.shirtNumber,
    }));

  return {
    ...base,
    goals,
    shots,
    bookings,
    substitutions,
    homeTeam: {
      ...base.homeTeam,
      lineup:
        providerArray(providerHomeTeam.lineup) ??
        homeLineup.filter(
          (l) => m.lineups.find((ml) => ml.playerId === l.id)?.isStarter,
        ),
      bench:
        providerArray(providerHomeTeam.bench) ??
        homeLineup.filter(
          (l) => !m.lineups.find((ml) => ml.playerId === l.id)?.isStarter,
        ),
    },
    awayTeam: {
      ...base.awayTeam,
      lineup:
        providerArray(providerAwayTeam.lineup) ??
        awayLineup.filter(
          (l) => m.lineups.find((ml) => ml.playerId === l.id)?.isStarter,
        ),
      bench:
        providerArray(providerAwayTeam.bench) ??
        awayLineup.filter(
          (l) => !m.lineups.find((ml) => ml.playerId === l.id)?.isStarter,
        ),
    },
    referees: providerArray(rawData.referees) ?? [],
  };
}
