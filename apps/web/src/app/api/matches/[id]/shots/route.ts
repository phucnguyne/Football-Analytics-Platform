import { NextResponse } from 'next/server'
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
  const shots = buildStatsBombShotMap(events)

  return NextResponse.json(
    {
      available: shots.length > 0,
      shots,
      source: shots.length > 0 ? 'statsbomb-open-data' : 'unavailable',
      matchId,
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    }
  )
}
