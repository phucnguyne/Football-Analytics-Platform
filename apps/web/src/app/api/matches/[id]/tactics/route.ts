import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { isPlaceholderPlayerName } from '@/lib/data-source'
import { buildStatsBombPassingNetwork, buildStatsBombTeamTacticalMetrics, readStatsBombEvents } from '@/lib/statsbomb'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const matchId = Number((await params).id)
  if (!Number.isSafeInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: 'invalid match id' }, { status: 400 })
  }

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        status: true,
        homeTeam: { select: { id: true, name: true, crest: true } },
        awayTeam: { select: { id: true, name: true, crest: true } },
        lineups: {
          select: { teamId: true, shirtNumber: true, position: true, isStarter: true,
            player: { select: { id: true, name: true, shirtNumber: true } } },
          orderBy: [{ isStarter: 'desc' }, { shirtNumber: 'asc' }],
        },
      },
    })
    if (!match) return NextResponse.json({ error: 'match not found' }, { status: 404 })
    const { homeTeam, awayTeam, lineups } = match

    const events = match.status === 'FINISHED'
      ? (await readStatsBombEvents(matchId)).filter((event) => (event.period ?? 1) <= 4)
      : []
    const identifiedEvents = events.filter((event) =>
      event.team?.id === match.homeTeam.id || event.team?.id === match.awayTeam.id,
    )
    function teamTactics(team: typeof homeTeam, opponentId: number) {
      const teamEvents = identifiedEvents.filter((event) => event.team?.id === team.id)
      const starting = teamEvents.find((event) => event.type?.name === 'Starting XI')?.tactics
      const starters = (starting?.lineup ?? []).flatMap(({ player, position, jersey_number }) =>
        player?.id && player.name ? [{
          id: player.id, name: player.name, shirtNumber: jersey_number ?? null,
          position: position?.name ?? null, isStarter: true,
        }] : [],
      )
      const localLineup = lineups.filter((lineup) =>
        lineup.teamId === team.id && !isPlaceholderPlayerName(lineup.player.name),
      ).map((lineup) => ({
        id: lineup.player.id, name: lineup.player.name,
        shirtNumber: lineup.shirtNumber ?? lineup.player.shirtNumber,
        position: lineup.position, isStarter: lineup.isStarter,
      }))
      const hasPasses = teamEvents.some((event) => event.type?.name === 'Pass')
      return {
        ...team,
        lineup: starters.length ? starters : localLineup,
        formation: starters.length ? starting?.formation ?? null : null,
        passingNetwork: hasPasses ? buildStatsBombPassingNetwork(teamEvents) : null,
        metrics: hasPasses ? buildStatsBombTeamTacticalMetrics(identifiedEvents, team.id, opponentId) : null,
      }
    }

    const home = teamTactics(homeTeam, awayTeam.id)
    const away = teamTactics(awayTeam, homeTeam.id)
    const available = home.metrics !== null || away.metrics !== null
    return NextResponse.json({
      available, source: available ? 'statsbomb-open-data' : 'unavailable',
      eventCount: identifiedEvents.length,
      passCount: (home.metrics?.passes ?? 0) + (away.metrics?.passes ?? 0),
      passingNetwork: available ? {
        nodes: [...(home.passingNetwork?.nodes ?? []), ...(away.passingNetwork?.nodes ?? [])],
        links: [...(home.passingNetwork?.links ?? []), ...(away.passingNetwork?.links ?? [])],
      } : null,
      tacticalMetrics: { home: home.metrics, away: away.metrics },
      teams: [home, away],
    }, {
      headers: { 'Cache-Control': available ? 'public, s-maxage=1800, stale-while-revalidate=3600' : 'public, s-maxage=60' },
    })
  } catch (error) {
    console.error('Error serving tactics data:', error)
    return NextResponse.json({ error: 'tactical data unavailable' }, { status: 503 })
  }
}
