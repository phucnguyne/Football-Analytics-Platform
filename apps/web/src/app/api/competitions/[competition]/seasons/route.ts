import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { env } from '@/lib/env'
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

  if (seasons.length > 0) {
    return NextResponse.json(
      {
        seasons: seasons.map((season) => ({
          ...season,
          id: season.year,
          startDate: season.startDate.toISOString(),
          endDate: season.endDate.toISOString(),
        })),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    )
  }

  try {
    const response = await fetch(
      `${env.FOOTBALL_DATA_API_URL}/competitions/${competition}`,
      {
        headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
        next: { revalidate: 21600 },
      },
    )
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Could not load seasons from the football data provider' },
        { status: response.status },
      )
    }

    const data = await response.json()
    const availableSeasons = (data.seasons ?? [])
      .filter((season: { startDate?: string; endDate?: string }) => season.startDate && season.endDate)
      .map((season: {
        startDate: string
        endDate: string
      }) => {
        const year = new Date(season.startDate).getUTCFullYear()
        const now = new Date()
        const isCurrent = new Date(season.startDate) <= now && now <= new Date(season.endDate)

        return {
          id: year,
          year,
          startDate: season.startDate,
          endDate: season.endDate,
          isCurrent,
        }
      })
      .filter((season: { year: number }, index: number, list: { year: number }[]) =>
        list.findIndex((candidate) => candidate.year === season.year) === index,
      )
      .sort((a: { year: number }, b: { year: number }) => b.year - a.year)

    return NextResponse.json(
      { seasons: availableSeasons },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
        },
      },
    )
  } catch (error) {
    console.error('Error fetching competition seasons:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}