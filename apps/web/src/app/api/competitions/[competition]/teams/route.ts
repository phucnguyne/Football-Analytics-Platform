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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ competition: string }> }
) {
  const { competition } = await params

  try {
    const requestedSeason = parseSeasonIdentifier(
      _req.nextUrl.searchParams.get('seasonId'),
    )
    const leagueId = getCompetitionLeagueId(competition)
    const season = await prisma.season.findFirst({
      where: {
        ...(leagueId ? { leagueId } : {}),
        ...getSeasonFilter(requestedSeason),
      },
    })

    if (season) {
      const teamSeasons = await prisma.teamSeason.findMany({
        where: { seasonId: season.id },
        include: { team: true },
      })

      if (teamSeasons.length > 0) {
        return NextResponse.json(
          { teams: teamSeasons.map((teamSeason) => toTeamResponse(teamSeason.team)) },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
          },
        )
      }
    }

    try {
      const res = await fetch(
        `${env.FOOTBALL_DATA_API_URL}/competitions/${competition}/teams${getExternalSeasonQuery(season?.year ?? (requestedSeason && requestedSeason >= 1800 ? requestedSeason : undefined))}`,
        {
          headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
          next: { revalidate: 300 },
        },
      )
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Could not load teams from the football data provider' },
          { status: res.status },
        )
      }
      return NextResponse.json(await res.json(), {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      })
    } catch (error) {
      console.error(`Error fetching teams for competition ${competition}:`, error)
      return NextResponse.json({ error: 'internal error' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error fetching teams:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
