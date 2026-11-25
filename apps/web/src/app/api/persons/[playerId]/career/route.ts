import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { getPlayerCareerTeams, resolveApiFootballPlayerId } from '@/lib/api-football'
import { isPlaceholderPlayerName } from '@/lib/data-source'
import type { CareerHistory } from '@/lib/career-history'
import { env } from '@/lib/env'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const id = Number((await params).playerId)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid player id' }, { status: 400 })
  }

  try {
    const player = await prisma.player.findUnique({
      where: { id },
      select: {
        name: true,
        teams: {
          select: { from: true, to: true, team: { select: { id: true, name: true } } },
          orderBy: [{ from: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
        },
        stats: {
          select: { dataSource: true, seasonId: true, matchesPlayed: true, minutesPlayed: true, goals: true, assists: true },
        },
      },
    })
    let name = player?.name
    if (!name) {
      const response = await fetch(`${env.FOOTBALL_DATA_API_URL}/persons/${id}`, {
        headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
        redirect: 'error',
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000),
      })
      if (response.status === 404) return NextResponse.json({ error: 'player not found' }, { status: 404 })
      if (!response.ok) return NextResponse.json({ error: 'player provider unavailable' }, { status: 502 })
      const person: { name?: string } = await response.json()
      name = person.name
    }
    if (!name || isPlaceholderPlayerName(name)) {
      return NextResponse.json({ error: 'player not found' }, { status: 404 })
    }

    const stats = player?.stats?.dataSource === 'REAL' ? player.stats : null
    const [providerClubs, season] = await Promise.all([
      resolveApiFootballPlayerId(id, name)
        .then((providerId) => providerId ? getPlayerCareerTeams(providerId) : [])
        .catch(() => []),
      stats?.seasonId
        ? prisma.season.findUnique({ where: { id: stats.seasonId }, select: { year: true } })
        : null,
    ])
    const history: CareerHistory = {
      clubs: providerClubs.length ? providerClubs.map(({ team, seasons }) => ({
        id: team.id, name: team.name, from: null, to: null, seasons, source: 'api-football',
      })) : (player?.teams ?? []).map(({ team, from, to }) => ({
        id: team.id, name: team.name, from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null, seasons: [], source: 'database',
      })),
      seasonStats: stats ? {
        season: season?.year ?? null, matchesPlayed: stats.matchesPlayed,
        minutesPlayed: stats.minutesPlayed, goals: stats.goals, assists: stats.assists,
      } : null,
    }
    return NextResponse.json(history, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Career API error:', error)
    return NextResponse.json({ error: 'career data unavailable' }, { status: 503 })
  }
}
