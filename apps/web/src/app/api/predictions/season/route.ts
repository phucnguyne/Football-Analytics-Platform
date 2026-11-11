import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const SIMULATIONS = 10_000;
const TOP_FOUR_PLACES = 4;
const RELEGATION_PLACES = 3;
const COMPETITION_CODE = "PL";
const FORM_HALF_LIFE_DAYS = 45;
const PRIOR_MATCHES = 3;

interface ProviderTeam {
  id: number;
  name: string;
  shortName?: string;
  crest?: string | null;
}

interface ProviderMatch {
  utcDate: string;
  status: string;
  homeTeam: ProviderTeam;
  awayTeam: ProviderTeam;
  score?: { fullTime?: { home?: number | null; away?: number | null } };
}

interface TeamStats {
  teamId: number;
  name: string;
  shortName: string;
  crest: string | null;
  currentPoints: number;
  currentPlayed: number;
  currentGF: number;
  currentGA: number;
  homeWeight: number;
  homeWeightedGoalsScored: number;
  homeWeightedGoalsConceded: number;
  awayWeight: number;
  awayWeightedGoalsScored: number;
  awayWeightedGoalsConceded: number;
}

interface TeamStrength {
  homeAttack: number;
  homeDefense: number;
  awayAttack: number;
  awayDefense: number;
}

async function fetchProvider<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${env.FOOTBALL_DATA_API_URL}${endpoint}`, {
    headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(
      `Football-data.org ${endpoint} request failed: ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

function poissonSample(lambda: number): number {
  const threshold = Math.exp(-lambda);
  let probability = 1;
  let goals = 0;

  do {
    goals++;
    probability *= Math.random();
  } while (probability > threshold);

  return goals - 1;
}

function weightedRate(
  weightedTotal: number,
  weight: number,
  leagueAverage: number,
): number {
  return (
    (weightedTotal + leagueAverage * PRIOR_MATCHES) / (weight + PRIOR_MATCHES)
  );
}

function strength(rate: number, leagueAverage: number): number {
  return leagueAverage > 0 ? rate / leagueAverage : 1;
}

export async function GET() {
  try {
    const competition = await fetchProvider<{
      name: string;
      currentSeason?: { startDate: string };
    }>(`/competitions/${COMPETITION_CODE}`);
    const currentSeason = competition.currentSeason;

    if (!currentSeason?.startDate) {
      return NextResponse.json(
        {
          error:
            "Football-data.org did not return a current Premier League season",
        },
        { status: 503 },
      );
    }

    const season = new Date(currentSeason.startDate).getUTCFullYear();
    const data = await fetchProvider<{ matches?: ProviderMatch[] }>(
      `/competitions/${COMPETITION_CODE}/matches?season=${season}`,
    );
    const matches = data.matches ?? [];
    const stats = new Map<number, TeamStats>();

    const ensureTeam = (team: ProviderTeam) => {
      const existing = stats.get(team.id);
      if (existing) return existing;

      const teamStats: TeamStats = {
        teamId: team.id,
        name: team.name,
        shortName: team.shortName || team.name,
        crest: team.crest ?? null,
        currentPoints: 0,
        currentPlayed: 0,
        currentGF: 0,
        currentGA: 0,
        homeWeight: 0,
        homeWeightedGoalsScored: 0,
        homeWeightedGoalsConceded: 0,
        awayWeight: 0,
        awayWeightedGoalsScored: 0,
        awayWeightedGoalsConceded: 0,
      };
      stats.set(team.id, teamStats);
      return teamStats;
    };

    for (const match of matches) {
      ensureTeam(match.homeTeam);
      ensureTeam(match.awayTeam);
    }

    let totalHomeGoals = 0;
    let totalAwayGoals = 0;
    let scoredMatchCount = 0;
    let leagueWeight = 0;
    let weightedHomeGoals = 0;
    let weightedAwayGoals = 0;
    const now = Date.now();
    for (const match of matches) {
      const homeGoals = match.score?.fullTime?.home;
      const awayGoals = match.score?.fullTime?.away;
      if (match.status !== "FINISHED" || homeGoals == null || awayGoals == null)
        continue;

      const home = ensureTeam(match.homeTeam);
      const away = ensureTeam(match.awayTeam);
      totalHomeGoals += homeGoals;
      totalAwayGoals += awayGoals;
      scoredMatchCount++;

      const ageDays = Math.max(
        0,
        (now - new Date(match.utcDate).getTime()) / (24 * 60 * 60 * 1000),
      );
      const recencyWeight = Math.pow(2, -ageDays / FORM_HALF_LIFE_DAYS);
      leagueWeight += recencyWeight;
      weightedHomeGoals += homeGoals * recencyWeight;
      weightedAwayGoals += awayGoals * recencyWeight;

      home.currentPlayed++;
      away.currentPlayed++;
      home.currentGF += homeGoals;
      home.currentGA += awayGoals;
      away.currentGF += awayGoals;
      away.currentGA += homeGoals;

      home.homeWeight += recencyWeight;
      home.homeWeightedGoalsScored += homeGoals * recencyWeight;
      home.homeWeightedGoalsConceded += awayGoals * recencyWeight;
      away.awayWeight += recencyWeight;
      away.awayWeightedGoalsScored += awayGoals * recencyWeight;
      away.awayWeightedGoalsConceded += homeGoals * recencyWeight;

      if (homeGoals > awayGoals) home.currentPoints += 3;
      else if (homeGoals < awayGoals) away.currentPoints += 3;
      else {
        home.currentPoints++;
        away.currentPoints++;
      }
    }

    if (scoredMatchCount === 0 || stats.size === 0) {
      return NextResponse.json(
        {
          error:
            "No completed current-season Premier League matches are available",
        },
        { status: 400 },
      );
    }

    const remaining = matches.filter(
      (match) =>
        (match.status === "SCHEDULED" || match.status === "TIMED") &&
        new Date(match.utcDate).getTime() >= now,
    );
    const leagueAvgHome = weightedHomeGoals / leagueWeight;
    const leagueAvgAway = weightedAwayGoals / leagueWeight;
    const teamList = [...stats.values()];
    const strengths = new Map<number, TeamStrength>();
    for (const team of teamList) {
      strengths.set(team.teamId, {
        homeAttack: strength(
          weightedRate(
            team.homeWeightedGoalsScored,
            team.homeWeight,
            leagueAvgHome,
          ),
          leagueAvgHome,
        ),
        homeDefense: strength(
          weightedRate(
            team.homeWeightedGoalsConceded,
            team.homeWeight,
            leagueAvgAway,
          ),
          leagueAvgAway,
        ),
        awayAttack: strength(
          weightedRate(
            team.awayWeightedGoalsScored,
            team.awayWeight,
            leagueAvgAway,
          ),
          leagueAvgAway,
        ),
        awayDefense: strength(
          weightedRate(
            team.awayWeightedGoalsConceded,
            team.awayWeight,
            leagueAvgHome,
          ),
          leagueAvgHome,
        ),
      });
    }
    const currentRank = new Map(
      [...teamList]
        .sort(
          (a, b) =>
            b.currentPoints - a.currentPoints ||
            b.currentGF - b.currentGA - (a.currentGF - a.currentGA) ||
            b.currentGF - a.currentGF ||
            a.name.localeCompare(b.name),
        )
        .map((team, index) => [team.teamId, index + 1]),
    );
    const positionTotals = new Map(teamList.map(({ teamId }) => [teamId, 0]));
    const titleCounts = new Map(teamList.map(({ teamId }) => [teamId, 0]));
    const topFourCounts = new Map(teamList.map(({ teamId }) => [teamId, 0]));
    const relegationCounts = new Map(teamList.map(({ teamId }) => [teamId, 0]));
    const pointsTotals = new Map(teamList.map(({ teamId }) => [teamId, 0]));

    for (let simulation = 0; simulation < SIMULATIONS; simulation++) {
      const points = new Map(
        teamList.map(({ teamId, currentPoints }) => [teamId, currentPoints]),
      );
      const goalsFor = new Map(
        teamList.map(({ teamId, currentGF }) => [teamId, currentGF]),
      );
      const goalsAgainst = new Map(
        teamList.map(({ teamId, currentGA }) => [teamId, currentGA]),
      );

      for (const match of remaining) {
        const home = stats.get(match.homeTeam.id);
        const away = stats.get(match.awayTeam.id);
        const homeStrength = strengths.get(match.homeTeam.id);
        const awayStrength = strengths.get(match.awayTeam.id);
        if (!home || !away || !homeStrength || !awayStrength) continue;

        const expectedHomeGoals =
          leagueAvgHome * homeStrength.homeAttack * awayStrength.awayDefense;
        const expectedAwayGoals =
          leagueAvgAway * awayStrength.awayAttack * homeStrength.homeDefense;
        const homeGoals = poissonSample(expectedHomeGoals);
        const awayGoals = poissonSample(expectedAwayGoals);
        goalsFor.set(home.teamId, (goalsFor.get(home.teamId) ?? 0) + homeGoals);
        goalsAgainst.set(
          home.teamId,
          (goalsAgainst.get(home.teamId) ?? 0) + awayGoals,
        );
        goalsFor.set(away.teamId, (goalsFor.get(away.teamId) ?? 0) + awayGoals);
        goalsAgainst.set(
          away.teamId,
          (goalsAgainst.get(away.teamId) ?? 0) + homeGoals,
        );

        if (homeGoals > awayGoals)
          points.set(home.teamId, (points.get(home.teamId) ?? 0) + 3);
        else if (homeGoals < awayGoals)
          points.set(away.teamId, (points.get(away.teamId) ?? 0) + 3);
        else {
          points.set(home.teamId, (points.get(home.teamId) ?? 0) + 1);
          points.set(away.teamId, (points.get(away.teamId) ?? 0) + 1);
        }
      }

      const ranking = teamList
        .map(({ teamId }) => teamId)
        .sort(
          (a, b) =>
            (points.get(b) ?? 0) - (points.get(a) ?? 0) ||
            (goalsFor.get(b) ?? 0) -
              (goalsAgainst.get(b) ?? 0) -
              ((goalsFor.get(a) ?? 0) - (goalsAgainst.get(a) ?? 0)) ||
            (goalsFor.get(b) ?? 0) - (goalsFor.get(a) ?? 0),
        );

      ranking.forEach((teamId, index) => {
        positionTotals.set(
          teamId,
          (positionTotals.get(teamId) ?? 0) + index + 1,
        );
      });
      titleCounts.set(ranking[0], (titleCounts.get(ranking[0]) ?? 0) + 1);
      for (const teamId of ranking.slice(0, TOP_FOUR_PLACES)) {
        topFourCounts.set(teamId, (topFourCounts.get(teamId) ?? 0) + 1);
      }
      for (const teamId of ranking.slice(-RELEGATION_PLACES)) {
        relegationCounts.set(teamId, (relegationCounts.get(teamId) ?? 0) + 1);
      }
      for (const [teamId, finalPoints] of points) {
        pointsTotals.set(teamId, (pointsTotals.get(teamId) ?? 0) + finalPoints);
      }
    }

    const teams = teamList
      .map((team) => ({
        teamId: team.teamId,
        name: team.name,
        shortName: team.shortName,
        crest: team.crest,
        currentPosition: currentRank.get(team.teamId) ?? teamList.length,
        currentPoints: team.currentPoints,
        currentPlayed: team.currentPlayed,
        currentGD: team.currentGF - team.currentGA,
        predictedPosition:
          Math.round(
            ((positionTotals.get(team.teamId) ?? 0) / SIMULATIONS) * 10,
          ) / 10,
        avgPoints:
          Math.round(
            ((pointsTotals.get(team.teamId) ?? 0) / SIMULATIONS) * 10,
          ) / 10,
        titleProb:
          Math.round(
            ((titleCounts.get(team.teamId) ?? 0) / SIMULATIONS) * 1000,
          ) / 10,
        topFourProb:
          Math.round(
            ((topFourCounts.get(team.teamId) ?? 0) / SIMULATIONS) * 1000,
          ) / 10,
        relegationProb:
          Math.round(
            ((relegationCounts.get(team.teamId) ?? 0) / SIMULATIONS) * 1000,
          ) / 10,
      }))
      .sort((a, b) => a.currentPosition - b.currentPosition);

    return NextResponse.json(
      {
        competition: competition.name,
        season,
        source:
          "Football-data.org current-season results and fixtures (cached for 5 minutes)",
        simulations: SIMULATIONS,
        matchesPlayed: scoredMatchCount,
        matchesRemaining: remaining.length,
        leagueAvgHomeGoals: Math.round(leagueAvgHome * 100) / 100,
        leagueAvgAwayGoals: Math.round(leagueAvgAway * 100) / 100,
        formHalfLifeDays: FORM_HALF_LIFE_DAYS,
        strengthPriorMatches: PRIOR_MATCHES,
        teams,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error("Prediction error:", error);
    return NextResponse.json(
      {
        error: "Could not load real Premier League data from Football-data.org",
      },
      { status: 502 },
    );
  }
}
