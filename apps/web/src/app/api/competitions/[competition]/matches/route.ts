import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toMatchResponse } from '@/lib/db-helpers'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ competition: string }> }
) {
  const { competition } = await params

  try {
    // Find the current season for this league
    const season = await prisma.season.findFirst({
      where: { isCurrent: true },
      include: { league: true },
    })

    if (!season) {
      // Fallback: proxy to external API if no season data
      const res = await fetch(
        `${process.env.FOOTBALL_DATA_API_URL}/competitions/${competition}/matches`,
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
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
    })
  } catch (error) {
    console.error('Error fetching competition matches:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}