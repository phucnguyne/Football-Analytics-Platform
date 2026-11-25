import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { buildStatsBombHeatmap, readStatsBombEvents } from '@/lib/statsbomb'

export async function GET(_request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const playerId = Number((await params).playerId)
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

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
