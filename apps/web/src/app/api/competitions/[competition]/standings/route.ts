import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toTeamResponse } from '@/lib/db-helpers'
import { env } from '@/lib/env'
import {
  getCompetitionLeagueId,
  getExternalSeasonQuery,
  getSeasonFilter,
  parseSeasonIdentifier,
} from '@/lib/competition-seasons'
import { getHistoricalPremierLeagueMatches } from '@/lib/football-data-uk'

interface ProviderMatch {
  status: string
  homeTeam: { id: number; name: string; shortName?: string; crest?: string | null }
  awayTeam: { id: number; name: string; shortName?: string; crest?: string | null }
  score?: { fullTime?: { home?: number | null; away?: number | null } }
}

function standingsFromMatches(matches: ProviderMatch[]) {
  const teams = new Map<number, {
    team: ProviderMatch['homeTeam']
    playedGames: number
    won: number
    draw: number
    lost: number
    points: number
    goalsFor: number
    goalsAgainst: number
  }>()

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
    if (match.status !== 'FINISHED' || homeGoals == null || awayGoals == null) continue

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
    .sort((a, b) =>
      b.points - a.points ||
      (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ competition: string }> }
) {
  const { competition } = await params

  try {
    const requestedSeason = parseSeasonIdentifier(
      req.nextUrl.searchParams.get('seasonId'),
    )
    if (
      competition.toUpperCase() === 'PL' &&
      requestedSeason !== undefined &&
      requestedSeason >= 1800 &&
      requestedSeason < new Date().getUTCFullYear()
    ) {
      let knownTeams: { id: number; name: string; shortName: string; crest: string | null }[] = []
      try {
        knownTeams = await prisma.team.findMany({
          select: { id: true, name: true, shortName: true, crest: true },
        })
      } catch (error) {
        console.warn('Could not load team details for historical standings:', error)
      }

      const historicalMatches = await getHistoricalPremierLeagueMatches(
        requestedSeason,
        knownTeams,
      )
      const table = standingsFromMatches(historicalMatches)
      if (table.length > 0) {
        return NextResponse.json(
          {
            standings: [{ type: 'TOTAL', table }],
            source: 'football-data.co.uk',
          },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          },
        )
      }
    }

    const leagueId = getCompetitionLeagueId(competition)
    const season = await prisma.season.findFirst({
      where: {
        ...(leagueId ? { leagueId } : {}),
        ...getSeasonFilter(requestedSeason),
      },
    })

    if (season) {
      const standings = await prisma.standing.findMany({
        where: { seasonId: season.id, type: 'TOTAL' },
        include: { team: true },
        orderBy: { position: 'asc' },
      })

      if (standings.length > 0) {
        return NextResponse.json(
          {
            standings: [
              {
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
              },
            ],
          },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
          },
        )
      }
    }

    const seasonYear =
      season?.year ??
      (requestedSeason && requestedSeason >= 1800 ? requestedSeason : undefined)
    const res = await fetch(
      `${env.FOOTBALL_DATA_API_URL}/competitions/${competition}/standings${getExternalSeasonQuery(seasonYear)}`,
      {
        headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
        next: { revalidate: 300 },
      },
    )
    if (!res.ok) {
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
            return NextResponse.json(
              {
                standings: [{ type: 'TOTAL', table }],
                source: 'football-data.co.uk',
              },
              {
                headers: {
                  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
                },
              },
            )
          }
        } catch (fallbackError) {
          console.warn('Historical Premier League standings fallback failed:', fallbackError)
        }
      }

      const matchesResponse = await fetch(
        `${env.FOOTBALL_DATA_API_URL}/competitions/${competition}/matches${getExternalSeasonQuery(seasonYear)}`,
        {
          headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
          next: { revalidate: 300 },
        },
      )

      if (matchesResponse.ok) {
        const matchData = await matchesResponse.json()
        const table = standingsFromMatches(matchData.matches ?? [])
        if (table.length > 0) {
          return NextResponse.json(
            { standings: [{ type: 'TOTAL', table }] },
            {
              headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
              },
            },
          )
        }
      }

      const unavailableMessage = matchesResponse.ok
        ? `No completed match data is available for the ${seasonYear ?? 'selected'} season.`
        : matchesResponse.status === 403
          ? `Historical data for the ${seasonYear ?? 'selected'} season is not available from the configured football data provider.`
          : 'Could not load standings or completed matches from the football data provider.'
      return NextResponse.json(
        { error: unavailableMessage },
        { status: matchesResponse.ok ? 404 : matchesResponse.status },
      )
    }
    return NextResponse.json(await res.json(), {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Error fetching standings:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
