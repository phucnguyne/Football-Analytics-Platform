import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { getFixtureEvents, resolveApiFootballFixtureId } from '@/lib/api-football'

function normalizeEvent(event: Awaited<ReturnType<typeof getFixtureEvents>>[number], homeTeamId: number) {
  const type = event.type?.toLowerCase()
  const minute = event.time?.elapsed ?? 0
  const team = event.team?.id === homeTeamId ? 'HOME' : 'AWAY'
  if (type === 'goal') {
    return { type: event.detail?.toLowerCase().includes('penalty') ? 'PENALTY_GOAL' : 'GOAL', eventType: 'goal', minute, injuryTime: event.time?.extra ?? null, team: event.team, scorer: event.player, assist: event.assist }
  }
  if (type === 'shot') return {
    type: 'SHOT',
    eventType: 'shot',
    minute,
    team,
    teamObject: event.team,
    player: event.player,
    x: event.x != null && event.x > 1 ? event.x / 100 : event.x,
    y: event.y != null && event.y > 1 ? event.y / 100 : event.y,
    xG: event.xG,
  }
  if (type === 'card') return { eventType: 'booking', minute, team, teamObject: event.team, player: event.player, card: event.detail }
  if (type === 'subst') return { eventType: 'sub', minute, team, teamObject: event.team, playerOut: event.player, playerIn: event.assist }
  return null
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const matchId = Number((await params).id)
  if (!Number.isInteger(matchId) || matchId <= 0) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      homeTeamId: true,
      rawData: true,
      utcDate: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  })
  if (!match) return NextResponse.json({ error: 'match not found' }, { status: 404 })
  const fixtureId = await resolveApiFootballFixtureId({
    localMatchId: matchId,
    rawData: match.rawData,
    utcDate: match.utcDate,
    homeTeamName: match.homeTeam.name,
    awayTeamName: match.awayTeam.name,
  })
  if (!fixtureId) return NextResponse.json({ available: false, events: [], reason: 'No API-Football fixture mapping configured.' })
  const events = (await getFixtureEvents(fixtureId)).map((event) => normalizeEvent(event, match.homeTeamId)).filter(Boolean)
  return NextResponse.json({ available: events.length > 0, events, fixtureId, source: 'api-football' }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
}