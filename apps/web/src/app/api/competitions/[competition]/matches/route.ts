import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toMatchResponse } from '@/lib/db-helpers'
import { env } from '@/lib/env'
import { getCompetitionLeagueId } from '@/lib/competition-seasons'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ competition: string }> }
) {
  const { competition } = await params

  try {
    const requestedSeasonId = Number(req.nextUrl.searchParams.get('seasonId'))
    const leagueId = getCompetitionLeagueId(competition)
    const season = await prisma.season.findFirst({
      where: {
        ...(leagueId ? { leagueId } : {}),
        ...(Number.isInteger(requestedSeasonId) && requestedSeasonId > 0
          ? { id: requestedSeasonId }
          : { isCurrent: true }),
      },
      include: { league: true },
    })

    if (!season) {
      // Fallback: proxy to external API if no season data
      const res = await fetch(
        `${env.FOOTBALL_DATA_API_URL}/competitions/${competition}/matches`,
        { headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY } }
      )
      if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: res.status })
      return NextResponse.json(await res.json())
    }

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

    return NextResponse.json({
      matches: matches.map(toMatchResponse),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Error fetching competition matches:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}