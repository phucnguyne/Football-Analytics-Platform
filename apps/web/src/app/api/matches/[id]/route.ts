import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toMatchDetailResponse } from '@/lib/db-helpers'
import type { EventType, Side } from '@app/database'

const API_URL = process.env.FOOTBALL_DATA_API_URL ?? 'https://api.football-data.org/v4'
const API_KEY = process.env.FOOTBALL_DATA_API_KEY!

/** Fetch detailed match data from football-data.org and save events to DB */
async function fetchAndSaveMatchDetails(matchId: number, homeTeamId: number) {
  const res = await fetch(`${API_URL}/matches/${matchId}`, {
    headers: { 'X-Auth-Token': API_KEY },
  })
  if (!res.ok) return null

  const data = await res.json()

  // Save raw API response
  await prisma.match.update({
    where: { id: matchId },
    data: { rawData: data },
  })

  const events: {
    matchId: number
    type: EventType
    minute: number
    minuteExtra: number | null
    team: Side
    playerId: number | null
    relatedPlayerId: number | null
    detail: string | null
  }[] = []

  // Parse goals
  if (data.goals) {
    for (const g of data.goals) {
      const side: Side = g.team?.id === homeTeamId ? 'HOME' : 'AWAY'
      let type: EventType = 'GOAL'
      if (g.type === 'OWN') type = 'OWN_GOAL'
      if (g.type === 'PENALTY') type = 'PENALTY_GOAL'

      events.push({
        matchId,
        type,
        minute: g.minute ?? 0,
        minuteExtra: g.injuryTime ?? null,
        team: side,
        playerId: g.scorer?.id ?? null,
        relatedPlayerId: g.assist?.id ?? null,
        detail: g.scorer?.name ?? null,
      })
    }
  }

  // Parse bookings
  if (data.bookings) {
    for (const b of data.bookings) {
      const side: Side = b.team?.id === homeTeamId ? 'HOME' : 'AWAY'
      let type: EventType = 'YELLOW_CARD'
      if (b.card === 'RED' || b.card === 'RED_CARD') type = 'RED_CARD'
      if (b.card === 'SECOND_YELLOW') type = 'SECOND_YELLOW'

      events.push({
        matchId,
        type,
        minute: b.minute ?? 0,
        minuteExtra: null,
        team: side,
        playerId: b.player?.id ?? null,
        relatedPlayerId: null,
        detail: b.player?.name ?? null,
      })
    }
  }

  // Parse substitutions
  if (data.substitutions) {
    for (const s of data.substitutions) {
      const side: Side = s.team?.id === homeTeamId ? 'HOME' : 'AWAY'
      events.push({
        matchId,
        type: 'SUBSTITUTION',
        minute: s.minute ?? 0,
        minuteExtra: null,
        team: side,
        playerId: s.playerOut?.id ?? null,
        relatedPlayerId: s.playerIn?.id ?? null,
        detail: `${s.playerOut?.name ?? '?'} → ${s.playerIn?.name ?? '?'}`,
      })
    }
  }

  // Batch create events (skip if none)
  if (events.length > 0) {
    // Delete existing events first to avoid duplicates on re-fetch
    await prisma.matchEvent.deleteMany({ where: { matchId } })
    await prisma.matchEvent.createMany({ data: events })
  }

  return data
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const matchId = parseInt(id)

  if (isNaN(matchId)) {
    return NextResponse.json({ error: 'invalid match id' }, { status: 400 })
  }

  try {
    // Query match from DB with all relations
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        score: true,
        league: true,
        events: {
          include: { player: true, relatedPlayer: true },
          orderBy: { minute: 'asc' },
        },
        lineups: {
          include: { player: true, team: true },
        },
        statistics: true,
      },
    })

    if (!match) {
      // Match not in DB — proxy to external API
      const res = await fetch(`${API_URL}/matches/${matchId}`, {
        headers: { 'X-Auth-Token': API_KEY },
      })
      if (!res.ok) return NextResponse.json({ error: 'not found' }, { status: res.status })
      return NextResponse.json(await res.json())
    }

    // Lazy-loading: if FINISHED but no events saved yet, fetch from API and cache
    const noEventsYet = match.events.length === 0
    const isFinished = match.status === 'FINISHED'

    if (isFinished && noEventsYet) {
      const apiData = await fetchAndSaveMatchDetails(matchId, match.homeTeamId)

      if (apiData) {
        // Return the raw API data directly (it has goals, bookings, subs)
        return NextResponse.json(apiData)
      }
    }

    // Return DB data in football-data.org shape
    return NextResponse.json(toMatchDetailResponse(match))
  } catch (error) {
    console.error('Error fetching match detail:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
