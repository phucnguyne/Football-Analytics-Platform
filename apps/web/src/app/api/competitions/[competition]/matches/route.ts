import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toMatchResponse } from '@/lib/db-helpers'
import { env } from '@/lib/env'
import {
  getCompetitionLeagueId,
  getExternalSeasonQuery,
  getSeasonFilter,
  parseSeasonIdentifier,
} from '@/lib/competition-seasons'
import { getHistoricalPremierLeagueMatches } from '@/lib/football-data-uk'

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
        console.warn('Could not load team details for historical matches:', error)
      }

      const historicalMatches = await getHistoricalPremierLeagueMatches(
        requestedSeason,
        knownTeams,
      )
      if (historicalMatches.length > 0) {
        return NextResponse.json(
          { matches: historicalMatches, source: 'football-data.co.uk' },
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
      include: { league: true },
    })

    if (season) {
      const matches = await prisma.match.findMany({
        where: { seasonId: season.id },
        include: {
          homeTeam: true,
          awayTeam: true,
          score: true,
          league: true,
        },
        orderBy: { utcDate: 'asc' },
      })

      if (matches.length > 0) {
        return NextResponse.json(
          { matches: matches.map(toMatchResponse) },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
          },
        )
      }
    }

    const seasonYear =
      season?.year ??
      (requestedSeason && requestedSeason >= 1800 ? requestedSeason : undefined)
    const res = await fetch(
      `${env.FOOTBALL_DATA_API_URL}/competitions/${competition}/matches${getExternalSeasonQuery(seasonYear)}`,
      {
        headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
        next: { revalidate: 60 },
      },
    )
    if (!res.ok) {
      if (competition.toUpperCase() === 'PL' && seasonYear) {
        try {
          const knownTeams = await prisma.team.findMany({
            select: { id: true, name: true, shortName: true, crest: true },
          })
          const matches = await getHistoricalPremierLeagueMatches(seasonYear, knownTeams)
          if (matches.length > 0) {
            return NextResponse.json(
              { matches, source: 'football-data.co.uk' },
              {
                headers: {
                  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
                },
              },
            )
          }
        } catch (fallbackError) {
          console.warn('Historical Premier League matches fallback failed:', fallbackError)
        }
      }

      return NextResponse.json(
        { error: 'Could not load matches from the football data provider' },
        { status: res.status },
      )
    }
    return NextResponse.json(await res.json(), {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Error fetching competition matches:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}