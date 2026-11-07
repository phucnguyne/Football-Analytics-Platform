import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toMatchDetailResponse } from '@/lib/db-helpers'
import { env } from '@/lib/env'
import { computeTeamStrengths, computeMatchProbabilities } from '@/lib/poisson'
import { getHistoricalPremierLeagueMatchById } from '@/lib/football-data-uk'

const API_URL = env.FOOTBALL_DATA_API_URL
const API_KEY = env.FOOTBALL_DATA_API_KEY
const DETAILS_FETCHED_AT = '__matchDetailsFetchedAt'

/** Fetch and cache the provider's unmodified match details in the match record. */
async function fetchAndCacheMatchDetails(matchId: number) {
  const res = await fetch(`${API_URL}/matches/${matchId}`, {
    headers: { 'X-Auth-Token': API_KEY },
  })
  if (!res.ok) {
    console.warn('Football provider match detail request failed:', {
      matchId,
      status: res.status,
    })
    return null
  }

  const data: unknown = await res.json()
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Football data provider returned an invalid match detail response')
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      rawData: {
        ...data,
        [DETAILS_FETCHED_AT]: new Date().toISOString(),
      },
    },
  })

  return data
}

/**
 * Compute Poisson win-probability for a scheduled match and persist it
 * so subsequent requests skip the DB query.
 */
async function computeAndCachePrediction(
  matchId: number,
  homeTeamId: number,
  awayTeamId: number
): Promise<{ homeWin: number; draw: number; awayWin: number } | null> {
  try {
    // Use up to the last 38 finished league matches for team-strength calculation
    const finishedMatches = await prisma.match.findMany({
      where: { status: 'FINISHED' },
      include: { score: true },
      orderBy: { utcDate: 'desc' },
      take: 200,
    })

    const result = computeTeamStrengths(finishedMatches)
    if (!result) return null

    const { strengths, leagueAvgHome, leagueAvgAway } = result

    const homeS = strengths[homeTeamId] ?? { has: 1, hds: 1, aas: 1, ads: 1 }
    const awayS = strengths[awayTeamId] ?? { has: 1, hds: 1, aas: 1, ads: 1 }

    const lambdaHome = homeS.has * awayS.ads * leagueAvgHome
    const lambdaAway = awayS.aas * homeS.hds * leagueAvgAway

    const probs = computeMatchProbabilities(lambdaHome, lambdaAway)

    // Persist so we don't recompute on every request
    await prisma.match.update({
      where: { id: matchId },
      data: {
        winProbHome: probs.homeWin,
        winProbDraw: probs.draw,
        winProbAway: probs.awayWin,
      },
    })

    return probs
  } catch (err) {
    console.warn('[Prediction] Failed to compute prediction:', err)
    return null
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const matchId = Number(id)

  if (!Number.isInteger(matchId) || matchId === 0) {
    return NextResponse.json({ error: 'invalid match id' }, { status: 400 })
  }

  try {
    if (matchId < 0) {
      const knownTeams = await prisma.team.findMany({
        select: { id: true, name: true, shortName: true, crest: true },
      })
      const historicalMatch = await getHistoricalPremierLeagueMatchById(matchId, knownTeams)
      if (!historicalMatch) {
        return NextResponse.json({ error: 'historical match not found' }, { status: 404 })
      }

      return NextResponse.json(historicalMatch, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      })
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        score: true,
        league: true,
        events: {
          include: { player: true, relatedPlayer: true },
          orderBy: { minute: 'asc' },
        },
        lineups: {
          include: { player: true, team: true },
        },
        statistics: true,
      },
    })

    if (!match) {
      const res = await fetch(`${API_URL}/matches/${matchId}`, {
        headers: { 'X-Auth-Token': API_KEY },
      })
      if (!res.ok) return NextResponse.json({ error: 'not found' }, { status: res.status })
      return NextResponse.json(await res.json())
    }

    const rawData =
      match.rawData && typeof match.rawData === 'object' && !Array.isArray(match.rawData)
        ? match.rawData
        : null
    const detailsAlreadyFetched = Boolean(rawData?.[DETAILS_FETCHED_AT])

    if (detailsAlreadyFetched && rawData) {
      const { [DETAILS_FETCHED_AT]: _fetchedAt, ...providerData } = rawData
      // For SCHEDULED/TIMED only: attach Poisson prediction if stored
      const predictionField =
        (match.status === 'SCHEDULED' || match.status === 'TIMED') && match.winProbHome != null
          ? { prediction: { homeWin: match.winProbHome, draw: match.winProbDraw, awayWin: match.winProbAway } }
          : {}
      return NextResponse.json({ ...providerData, ...predictionField })
    }

    if (match.status === 'FINISHED' && !detailsAlreadyFetched) {
      const providerData = await fetchAndCacheMatchDetails(matchId)
      if (providerData) return NextResponse.json(providerData)
    }

    // For IN_PLAY/PAUSED: fetch live data from provider (don't cache — score changes every minute)
    if (match.status === 'IN_PLAY' || match.status === 'PAUSED') {
      try {
        const res = await fetch(`${API_URL}/matches/${matchId}`, {
          headers: { 'X-Auth-Token': API_KEY },
          // Short cache so CDN/Next cache doesn't serve stale score
          next: { revalidate: 30 },
        } as any)
        if (res.ok) {
          const liveData = await res.json()
          return NextResponse.json(liveData, {
            headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
          })
        }
      } catch (e) {
        console.warn('[Match] Live fetch failed, falling back to DB data:', e)
      }
    }

    // For upcoming matches: compute Poisson prediction if not yet stored
    if (
      (match.status === 'SCHEDULED' || match.status === 'TIMED') &&
      match.winProbHome === null
    ) {
      const prediction = await computeAndCachePrediction(
        matchId,
        match.homeTeamId,
        match.awayTeamId
      )

      if (prediction) {
        // Attach inline so the response reflects the freshly computed value
        return NextResponse.json({
          ...toMatchDetailResponse(match),
          prediction,
        })
      }
    }

    return NextResponse.json(toMatchDetailResponse(match))
  } catch (error) {
    console.error('Error fetching match detail:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
