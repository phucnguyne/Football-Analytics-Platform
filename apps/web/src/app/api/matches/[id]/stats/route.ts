import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const matchId = Number(id)
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return NextResponse.json({ error: 'invalid match id' }, { status: 400 })
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { statistics: true },
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const home = match.statistics.find((stat) => stat.team === 'HOME') ?? null
    const away = match.statistics.find((stat) => stat.team === 'AWAY') ?? null

    return NextResponse.json({
      available: home !== null || away !== null,
      possession: { home: home?.possession ?? null, away: away?.possession ?? null },
      shots: { home: home?.shots ?? null, away: away?.shots ?? null },
      shotsOnTarget: {
        home: home?.shotsOnTarget ?? null,
        away: away?.shotsOnTarget ?? null,
      },
      corners: { home: home?.corners ?? null, away: away?.corners ?? null },
      fouls: { home: home?.fouls ?? null, away: away?.fouls ?? null },
      momentum: [],
    })
  } catch (error) {
    console.error('Error fetching match statistics:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
