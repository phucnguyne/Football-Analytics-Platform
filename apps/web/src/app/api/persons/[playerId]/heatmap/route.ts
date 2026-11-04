import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { buildStatsBombHeatmap, readStatsBombEventsForMatches, fetchStatsBombMatchIds } from '@/lib/statsbomb'

export async function GET(_request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const playerId = Number((await params).playerId)
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  // 1. Find match IDs this player appears in (from DB lineups)
  const lineups = await prisma.matchLineup.findMany({
    where: { playerId },
    select: { matchId: true },
    take: 20,
  })

  let matchIds: number[] = lineups.map((l) => l.matchId)

  // 2. If no DB lineups, fall back to available StatsBomb match index (first 20)
  if (matchIds.length === 0) {
    const allIds = await fetchStatsBombMatchIds()
    matchIds = allIds.slice(0, 20)
  }

  const events = await readStatsBombEventsForMatches(matchIds)
  const points = buildStatsBombHeatmap(events, playerId)

  return NextResponse.json(
    {
      available: points.length > 0,
      points,
      source: points.length > 0 ? 'statsbomb-open-data' : 'unavailable',
      matchCount: matchIds.length,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  )
}
