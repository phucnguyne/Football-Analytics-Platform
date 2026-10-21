import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toMatchResponse } from '@/lib/db-helpers'

export async function GET(req: NextRequest) {
  const statusParam = req.nextUrl.searchParams.get('status') ?? 'LIVE,IN_PLAY,PAUSED'
  const statuses = statusParam.split(',').map(s => s.trim())

  try {
    const matches = await prisma.match.findMany({
      where: {
        status: { in: statuses as any },
      },
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
      // Live/in-play data — short TTL to stay near-real-time.
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch (error) {
    console.error('Error fetching matches:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
