import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toMatchResponse } from '@/lib/db-helpers'
import { z } from 'zod'

const matchStatuses = [
  'SCHEDULED',
  'TIMED',
  'IN_PLAY',
  'PAUSED',
  'FINISHED',
  'POSTPONED',
  'CANCELLED',
  'SUSPENDED',
] as const

const matchStatusSchema = z.enum(matchStatuses)

export async function GET(req: NextRequest) {
  const statusParam = req.nextUrl.searchParams.get('status') ?? 'IN_PLAY,PAUSED'
  const parsedStatuses = z.array(matchStatusSchema).safeParse(
    statusParam.split(',').map((status) => status.trim())
  )

  if (!parsedStatuses.success) {
    return NextResponse.json(
      { error: 'invalid match status', validStatuses: matchStatuses },
      { status: 400 }
    )
  }

  try {
    const matches = await prisma.match.findMany({
      where: {
        status: { in: parsedStatuses.data },
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
