import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { buildStatsBombHeatmap, readStatsBombEvents } from '@/lib/statsbomb'

export async function GET(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const playerId = Number((await params).playerId)
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }
  const shots = new URL(request.url).searchParams.get('view') === 'shots'
  const pitchSource = shots ? 'UNDERSTAT_SHOTS' : 'WYSCOUT_OPEN_DATA'
  const latest = await prisma.playerPitchPoint.findFirst({
    where: { playerId, source: pitchSource },
    orderBy: [{ season: 'desc' }, { date: 'desc' }],
    select: { season: true },
  })
  if (latest) {
    const entries = await prisma.playerPitchPoint.findMany({
      where: { playerId, source: pitchSource, season: latest.season },
      orderBy: [{ date: 'desc' }, { externalId: 'asc' }],
      select: { x: true, y: true, xG: true, externalMatchId: true },
    })
    return NextResponse.json({
      available: entries.length > 0,
      points: entries.map(({ x, y, xG }) => ({ x, y, xG, intensity: 1 })),
      source: shots ? 'understat-shots' : 'wyscout-open-data',
      season: latest.season, matchCount: new Set(entries.map((point) => point.externalMatchId)).size,
    }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
  }
  if (shots) return NextResponse.json({ available: false, points: [], source: 'unavailable', matchCount: 0 })

  const lineups = await prisma.matchLineup.findMany({
    where: { playerId, match: { status: 'FINISHED' } },
    select: { matchId: true, teamId: true },
    orderBy: [{ match: { utcDate: 'desc' } }, { matchId: 'desc' }, { teamId: 'asc' }],
    distinct: ['matchId'],
    take: 20,
  })

  const coveredMatches = []
  for (let index = 0; index < lineups.length; index += 5) {
    const batches = await Promise.all(lineups.slice(index, index + 5).map(async ({ matchId, teamId }) => {
      const events = await readStatsBombEvents(matchId)
      return buildStatsBombHeatmap(events.filter((event) => event.team?.id === teamId && (event.period ?? 1) <= 4), playerId)
    }))
    coveredMatches.push(...batches.filter((points) => points.length > 0))
  }

  const points = coveredMatches.flat()
  return NextResponse.json({
    available: points.length > 0,
    points,
    source: points.length > 0 ? 'statsbomb-open-data' : 'unavailable',
    matchCount: coveredMatches.length,
  }, {
    headers: { 'Cache-Control': points.length ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'public, s-maxage=60' },
  })
}
