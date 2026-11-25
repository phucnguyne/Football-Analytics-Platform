import 'server-only'
import prisma from '@app/database/src/client'
import { toTeamResponse } from '@/lib/db-helpers'
import { env } from '@/lib/env'
import {
  getCompetitionLeagueId,
  getExternalSeasonQuery,
  getSeasonFilter,
} from '@/lib/competition-seasons'
import { getHistoricalPremierLeagueMatches } from '@/lib/football-data-uk'

interface ProviderMatch {
  status: string
  homeTeam: {
    id: number
    name: string
    shortName?: string
    crest?: string | null
  }
  awayTeam: {
    id: number
    name: string
    shortName?: string
    crest?: string | null
  }
  score?: { fullTime?: { home?: number | null; away?: number | null } }
}

function standingsFromMatches(matches: ProviderMatch[]) {
  const teams = new Map<
    number,
    {
      team: ProviderMatch['homeTeam']
      playedGames: number
      won: number
      draw: number
      lost: number
      points: number
      goalsFor: number
      goalsAgainst: number
    }
  >()

  const getTeamStats = (team: ProviderMatch['homeTeam']) => {
    let stats = teams.get(team.id)
    if (!stats) {
      stats = {
        team,
        playedGames: 0,
        won: 0,
        draw: 0,
        lost: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      }
      teams.set(team.id, stats)
    }
    return stats
  }

  for (const match of matches) {
    const homeGoals = match.score?.fullTime?.home
    const awayGoals = match.score?.fullTime?.away
    if (match.status !== 'FINISHED' || homeGoals == null || awayGoals == null)
      continue

    const home = getTeamStats(match.homeTeam)
    const away = getTeamStats(match.awayTeam)
    home.playedGames += 1
    away.playedGames += 1
    home.goalsFor += homeGoals
    home.goalsAgainst += awayGoals
    away.goalsFor += awayGoals
    away.goalsAgainst += homeGoals

    if (homeGoals > awayGoals) {
      home.won += 1
      home.points += 3
      away.lost += 1
    } else if (homeGoals < awayGoals) {
      away.won += 1
      away.points += 3
      home.lost += 1
    } else {
      home.draw += 1
      away.draw += 1
      home.points += 1
      away.points += 1
    }
  }

  const table = [...teams.values()]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
        b.goalsFor - a.goalsFor,
    )
    .map((stats, index) => ({
      position: index + 1,
      team: stats.team,
      playedGames: stats.playedGames,
      won: stats.won,
      draw: stats.draw,
      lost: stats.lost,
      points: stats.points,
      goalsFor: stats.goalsFor,
      goalsAgainst: stats.goalsAgainst,
      goalDifference: stats.goalsFor - stats.goalsAgainst,
    }))

  return table
}

export async function getCompetitionStandings(
  competition: string,
  requestedSeason: number | undefined,
) {
  if (
    competition.toUpperCase() === 'PL' &&
    requestedSeason !== undefined &&
    requestedSeason >= 1800 &&
    requestedSeason < new Date().getUTCFullYear()
  ) {
    let knownTeams: {
      id: number
      name: string
      shortName: string
      crest: string | null
    }[] = []
    try {
      knownTeams = await prisma.team.findMany({
        select: { id: true, name: true, shortName: true, crest: true },
      })
    } catch (error) {
      console.warn(
        'Could not load team details for historical standings:',
        error,
      )
    }

    const historicalMatches = await getHistoricalPremierLeagueMatches(
      requestedSeason,
      knownTeams,
    )
    const table = standingsFromMatches(historicalMatches)
    if (table.length > 0) {
      return {
        data: {
          standings: [{ type: 'TOTAL', table }],
          source: 'football-data.co.uk',
        },
        cache: 'historical' as const,
      }
    }
  }

  const leagueId = getCompetitionLeagueId(competition)
  const season = await prisma.season.findFirst({
    where: {
      ...(leagueId ? { leagueId } : {}),
      ...getSeasonFilter(requestedSeason),
    },
  })

  const standings = season ? await prisma.standing.findMany({
    where: { seasonId: season.id, type: 'TOTAL' },
    include: { team: true },
    orderBy: { position: 'asc' },
  }) : []

  const stored = standings.length ? {
    data: {
      source: 'database',
      standings: [{
        type: 'TOTAL',
        table: standings.map((standing) => ({
          position: standing.position,
          team: toTeamResponse(standing.team),
          playedGames: standing.playedGames,
          won: standing.wins,
          draw: standing.draws,
          lost: standing.losses,
          points: standing.points,
          goalsFor: standing.goalsFor,
          goalsAgainst: standing.goalsAgainst,
          goalDifference: standing.goalDifference,
        })),
      }],
    },
    cache: 'standard' as const,
  } : null
  if (stored && (!season?.isCurrent || standings.every((row) => Date.now() - row.updatedAt.getTime() < 5 * 60_000))) {
    return stored
  }

  const seasonYear =
    season?.year ??
    (requestedSeason && requestedSeason >= 1800 ? requestedSeason : undefined)
  const res = await fetch(
    `${env.FOOTBALL_DATA_API_URL}/competitions/${competition}/standings${getExternalSeasonQuery(seasonYear)}`,
    {
      redirect: "error",      headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    },
  ).catch(() => null)
  if (!res?.ok) {
    if (stored) return stored
    if (!res) return { data: { error: 'Standings provider unavailable' }, status: 502 }
    if (competition.toUpperCase() === 'PL' && seasonYear) {
      try {
        const knownTeams = await prisma.team.findMany({
          select: { id: true, name: true, shortName: true, crest: true },
        })
        const historicalMatches = await getHistoricalPremierLeagueMatches(
          seasonYear,
          knownTeams,
        )
        const table = standingsFromMatches(historicalMatches)
        if (table.length > 0) {
          return {
            data: {
              standings: [{ type: 'TOTAL', table }],
              source: 'football-data.co.uk',
            },
            cache: 'historical' as const,
          }
        }
      } catch (fallbackError) {
        console.warn(
          'Historical Premier League standings fallback failed:',
          fallbackError,
        )
      }
    }

    const matchesResponse = await fetch(
      `${env.FOOTBALL_DATA_API_URL}/competitions/${competition}/matches${getExternalSeasonQuery(seasonYear)}`,
      {
        redirect: "error",        headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
        next: { revalidate: 300 },
      },
    )

    if (matchesResponse.ok) {
      const matchData = await matchesResponse.json()
      const table = standingsFromMatches(matchData.matches ?? [])
      if (table.length > 0) {
        return {
          data: { standings: [{ type: 'TOTAL', table }] },
          cache: 'standard' as const,
        }
      }
    }

    const unavailableMessage = matchesResponse.ok
      ? `No completed match data is available for the ${seasonYear ?? 'selected'} season.`
      : matchesResponse.status === 403
        ? `Historical data for the ${seasonYear ?? 'selected'} season is not available from the configured football data provider.`
        : 'Could not load standings or completed matches from the football data provider.'
    return {
      data: { error: unavailableMessage },
      status: matchesResponse.ok ? 404 : matchesResponse.status,
    }
  }
  return { data: await res.json(), cache: 'standard' as const }
}
