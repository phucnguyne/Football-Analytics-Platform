import "server-only";
import { unstable_cache } from "next/cache";
import prisma from "@app/database/src/client";
import { toMatchDetailResponse } from "@/lib/db-helpers";
import { env } from "@/lib/env";
import { computeTeamStrengths, computeMatchProbabilities } from "@/lib/poisson";
import { getHistoricalPremierLeagueMatchById } from "@/lib/football-data-uk";

const API_URL = env.FOOTBALL_DATA_API_URL;
const API_KEY = env.FOOTBALL_DATA_API_KEY;
const DETAILS_FETCHED_AT = "__matchDetailsFetchedAt";

const getRecentFinishedMatches = unstable_cache(
  () =>
    prisma.match.findMany({
      where: { status: "FINISHED" },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        score: { select: { homeTeamGoals: true, awayTeamGoals: true } },
      },
      orderBy: { utcDate: "desc" },
      take: 200,
    }),
  ["recent-finished-matches-for-prediction"],
  { revalidate: 300 },
);

/** Fetch and cache the provider's unmodified match details in the match record. */
async function fetchAndCacheMatchDetails(matchId: number) {
  const res = await fetch(`${API_URL}/matches/${matchId}`, {
    redirect: "error",    headers: { "X-Auth-Token": API_KEY },
  });
  if (!res.ok) {
    console.warn("Football provider match detail request failed:", {
      matchId,
      status: res.status,
    });
    return null;
  }

  const data: unknown = await res.json();
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(
      "Football data provider returned an invalid match detail response",
    );
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      rawData: {
        ...data,
        [DETAILS_FETCHED_AT]: new Date().toISOString(),
      },
    },
  });

  return data;
}

/**
 * Compute Poisson win-probability for a scheduled match and persist it
 * so subsequent requests skip the DB query.
 */
async function computeAndCachePrediction(
  matchId: number,
  homeTeamId: number,
  awayTeamId: number,
): Promise<{ homeWin: number; draw: number; awayWin: number } | null> {
  try {
    // Use up to the last 38 finished league matches for team-strength calculation
    const finishedMatches = await getRecentFinishedMatches();

    const result = computeTeamStrengths(finishedMatches);
    if (!result) return null;

    const { strengths, leagueAvgHome, leagueAvgAway } = result;

    const homeS = strengths[homeTeamId] ?? { has: 1, hds: 1, aas: 1, ads: 1 };
    const awayS = strengths[awayTeamId] ?? { has: 1, hds: 1, aas: 1, ads: 1 };

    const lambdaHome = homeS.has * awayS.ads * leagueAvgHome;
    const lambdaAway = awayS.aas * homeS.hds * leagueAvgAway;

    const probs = computeMatchProbabilities(lambdaHome, lambdaAway);

    // Persist so we don't recompute on every request
    await prisma.match.update({
      where: { id: matchId },
      data: {
        winProbHome: probs.homeWin,
        winProbDraw: probs.draw,
        winProbAway: probs.awayWin,
      },
    });

    return probs;
  } catch (err) {
    console.warn("[Prediction] Failed to compute prediction:", err);
    return null;
  }
}

export async function getMatchDetail(matchId: number) {
  if (matchId < 0) {
    const knownTeams = await prisma.team.findMany({
      select: { id: true, name: true, shortName: true, crest: true },
    });
    const historicalMatch = await getHistoricalPremierLeagueMatchById(
      matchId,
      knownTeams,
    );
    if (!historicalMatch) {
      return { data: { error: "historical match not found" }, status: 404 };
    }

    return { data: historicalMatch, cache: "historical" as const };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      utcDate: true,
      status: true,
      minute: true,
      matchday: true,
      stage: true,
      lastUpdated: true,
      homeTeamId: true,
      awayTeamId: true,
      rawData: true,
      winProbHome: true,
      winProbDraw: true,
      winProbAway: true,
      homeTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          crest: true,
          founded: true,
          venue: true,
        },
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          crest: true,
          founded: true,
          venue: true,
        },
      },
      score: {
        select: {
          winner: true,
          duration: true,
          homeTeamGoals: true,
          awayTeamGoals: true,
          homeTeamGoalsHT: true,
          awayTeamGoalsHT: true,
          scoreExtraTimeHome: true,
          scoreExtraTimeAway: true,
          scorePenaltyHome: true,
          scorePenaltyAway: true,
        },
      },
      league: { select: { id: true, name: true, emblem: true } },
      events: {
        select: {
          type: true,
          minute: true,
          minuteExtra: true,
          team: true,
          xG: true,
          x: true,
          y: true,
          player: { select: { id: true, name: true } },
          relatedPlayer: { select: { id: true, name: true } },
        },
        orderBy: { minute: "asc" },
      },
      lineups: {
        select: {
          teamId: true,
          playerId: true,
          isStarter: true,
          position: true,
          shirtNumber: true,
          player: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!match) {
    const res = await fetch(`${API_URL}/matches/${matchId}`, {
      redirect: "error",      headers: { "X-Auth-Token": API_KEY },
    });
    if (!res.ok) return { data: { error: "not found" }, status: res.status };
    return { data: await res.json() };
  }

  const rawData =
    match.rawData &&
    typeof match.rawData === "object" &&
    !Array.isArray(match.rawData)
      ? match.rawData
      : null;
  const detailsAlreadyFetched = Boolean(rawData?.[DETAILS_FETCHED_AT]);

  if (detailsAlreadyFetched && rawData) {
    const { [DETAILS_FETCHED_AT]: _fetchedAt, ...providerData } = rawData;
    // For SCHEDULED/TIMED only: attach Poisson prediction if stored
    const predictionField =
      (match.status === "SCHEDULED" || match.status === "TIMED") &&
      match.winProbHome != null
        ? {
            prediction: {
              homeWin: match.winProbHome,
              draw: match.winProbDraw,
              awayWin: match.winProbAway,
            },
          }
        : {};
    return { data: { ...providerData, ...predictionField } };
  }

  if (match.status === "FINISHED" && !detailsAlreadyFetched) {
    const providerData = await fetchAndCacheMatchDetails(matchId);
    if (providerData) return { data: providerData };
  }

  // For IN_PLAY/PAUSED: fetch live data from provider (don't cache — score changes every minute)
  if (match.status === "IN_PLAY" || match.status === "PAUSED") {
    try {
      const requestInit: RequestInit & { next: { revalidate: number } } = {
        redirect: "error",        headers: { "X-Auth-Token": API_KEY },
        // Short cache so CDN/Next cache doesn't serve stale score
        next: { revalidate: 30 },
      };
      const res = await fetch(`${API_URL}/matches/${matchId}`, requestInit);
      if (res.ok) {
        const liveData = await res.json();
        return { data: liveData, cache: "live" as const };
      }
    } catch (e) {
      console.warn("[Match] Live fetch failed, falling back to DB data:", e);
    }
  }

  // For upcoming matches: compute Poisson prediction if not yet stored
  if (
    (match.status === "SCHEDULED" || match.status === "TIMED") &&
    match.winProbHome === null
  ) {
    const prediction = await computeAndCachePrediction(
      matchId,
      match.homeTeamId,
      match.awayTeamId,
    );

    if (prediction) {
      // Attach inline so the response reflects the freshly computed value
      return {
        data: {
          ...toMatchDetailResponse(match),
          prediction,
        },
      };
    }
  }

  return { data: toMatchDetailResponse(match) };
}
