import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { env } from '@/lib/env'
import { getPlayerSeasonMetricsForTeam, apiFootballSeasonYear } from '@/lib/api-football'
import { isPlaceholderPlayerName } from '@/lib/data-source'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params
  const id = Number(playerId)

  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  try {
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        teams: {
          include: { team: true },
          orderBy: [{ to: { sort: 'desc', nulls: 'first' } }, { from: { sort: 'desc', nulls: 'last' } }],
        },
        stats: true,
      }
    })

    if (!player) {
      // Proxy to upstream if not found in our DB
      const res = await fetch(
        `${env.FOOTBALL_DATA_API_URL}/persons/${playerId}`,
        { headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY }, redirect: 'error' }
      )
      if (!res.ok) return NextResponse.json({ error: 'not found' }, { status: res.status })
      return NextResponse.json(await res.json())
    }
    if (isPlaceholderPlayerName(player.name)) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const trustedStats = player.stats?.dataSource === 'REAL' ? player.stats : null
    const currentTeam = player.teams.find(({ to }) => to === null)?.team
    const providerStats = !trustedStats && currentTeam
      ? await getPlayerSeasonMetricsForTeam(player.name, currentTeam.name, apiFootballSeasonYear()).catch(() => null)
      : null
    const positionalStats = trustedStats?.seasonId ? await prisma.playerStats.aggregate({
      where: {
        player: { position: player.position }, dataSource: 'REAL',
        seasonId: trustedStats.seasonId, matchesPlayed: { gt: 5 },
      },
      _avg: {
        xG: true,
        xA: true,
        shotsPer90: true,
        passCompletion: true,
        progressivePasses: true,
        tacklesPer90: true,
        interceptions: true,
        dribblesSuccess: true,
      }
    }) : null
    const databaseSeason = trustedStats?.seasonId
      ? await prisma.season.findUnique({ where: { id: trustedStats.seasonId }, select: { year: true } })
      : null

    const response = {
      id: player.id,
      name: player.name,
      position: player.position,
      dateOfBirth: player.dateOfBirth,
      nationality: player.nationality,
      shirtNumber: player.shirtNumber,
      photo: player.photo,
      teams: player.teams.map(t => ({
        id: t.team.id,
        name: t.team.name,
        shortName: t.team.shortName,
        crest: t.team.crest,
      })),
      stats: trustedStats ?? (providerStats ? { ...providerStats, dataSource: 'REAL', yellowCards: null, redCards: null } : null),
      statsSource: trustedStats ? 'database' : providerStats ? 'api-football' : 'unavailable',
      statsSeason: databaseSeason?.year ?? providerStats?.season ?? null,
      positionalAverages: positionalStats?._avg ?? null,
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Error fetching player:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
