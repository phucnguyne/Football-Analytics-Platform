import { matchFormHistory, xgModelInfo } from '@/lib/xg-model'
import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { buildStatsBombShotMap, readStatsBombEvents } from '@/lib/statsbomb'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const matchId = Number(id)

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: 'invalid match id' }, { status: 400 })
  }

  const events = await readStatsBombEvents(matchId)
  const shots = buildStatsBombShotMap(events, matchId)
  if (!shots.length) {
    const verifiedEvents = await prisma.matchEvent.findMany({
      where: {
        matchId, analyticsSource: 'REAL', type: { in: ['SHOT', 'GOAL', 'PENALTY_GOAL'] },
        x: { gte: 0, lte: 100 }, y: { gte: 0, lte: 100 },
      },
      select: {
        id: true, x: true, y: true, xG: true, minute: true, type: true, detail: true, team: true,
        player: { select: { id: true, name: true } },
        match: { select: { homeTeamId: true, awayTeamId: true } },
      },
      orderBy: [{ minute: 'asc' }, { id: 'asc' }],
    })
    const stored = verifiedEvents.flatMap(({ x, y, xG, type, team, match, minute, player, detail }) =>
      x === null || y === null ? [] : [{
        x, y, xG: null, providerXg: xG, usesForm: false, minute,
        outcome: type === 'SHOT' ? detail : 'Goal',
        teamId: team === 'HOME' ? match.homeTeamId : match.awayTeamId,
        player: player?.name ?? null, playerId: player?.id ?? null, isGoal: type !== 'SHOT',
      }],
    )
    return NextResponse.json({
      available: stored.length > 0, source: stored.length ? 'database' : 'unavailable',
      shots: stored, matchId, form: null, xgModel: null,
    }, {
      headers: { 'Cache-Control': stored.length ? 'public, s-maxage=300' : 'public, s-maxage=60' },
    })
  }

  return NextResponse.json(
    {
      available: true,
      shots,
      source: 'statsbomb-open-data',
      matchId,
      form: shots.some((shot) => shot.usesForm) ? matchFormHistory(matchId) : null,
      xgModel: shots.some((shot) => shot.xG !== null) ? xgModelInfo : null,
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    }
  )
}
