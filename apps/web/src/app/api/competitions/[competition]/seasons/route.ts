import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { getCompetitionLeagueId } from '@/lib/competition-seasons'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ competition: string }> },
) {
  const { competition } = await params
  const leagueId = getCompetitionLeagueId(competition)

  if (!leagueId) return NextResponse.json({ seasons: [] })

  const seasons = await prisma.season.findMany({
    where: { leagueId },
    select: { id: true, year: true, startDate: true, endDate: true, isCurrent: true },
    orderBy: { startDate: 'desc' },
  })

  return NextResponse.json({
    seasons: seasons.map((season) => ({
      ...season,
      startDate: season.startDate.toISOString(),
      endDate: season.endDate.toISOString(),
    })),
  }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}