import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import {
  buildStatsBombPassingNetwork,
  readStatsBombEvents,
  readStatsBombLineups,
} from '@/lib/statsbomb'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const matchId = Number(id)

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: 'invalid match id' }, { status: 400 })
  }

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        lineups: {
          include: { player: true },
          orderBy: [{ isStarter: 'desc' }, { shirtNumber: 'asc' }],
        },
      },
    })

    if (!match) {
      return NextResponse.json({ error: 'match not found' }, { status: 404 })
    }

    // DB lineup builder
    const getDbLineup = (teamId: number) =>
      match.lineups
        .filter((l) => l.teamId === teamId)
        .map((l) => ({
          id: l.player.id,
          name: l.player.name,
          shirtNumber: l.shirtNumber ?? l.player.shirtNumber,
          position: l.position,
          isStarter: l.isStarter,
        }))

    // ── StatsBomb events ──────────────────────────────────────────────────────
    const statsBombEvents = await readStatsBombEvents(matchId)

    // ── StatsBomb lineups (richer than DB) ────────────────────────────────────
    const sbLineups = await readStatsBombLineups(matchId)
    const getSbLineup = (teamId: number) => {
      const teamData = sbLineups.find((t) => t.team_id === teamId)
      if (!teamData) return null
      return teamData.lineup.map((p) => ({
        id: p.player_id,
        name: p.player_name,
        shirtNumber: p.jersey_number,
        position: p.position?.name ?? null,
        isStarter: true, // StatsBomb lineups list starters (sub info is in events)
      }))
    }

    if (statsBombEvents.length > 0) {
      const passingNetwork = buildStatsBombPassingNetwork(
        statsBombEvents.filter((e) => e.type?.name === 'Pass')
      )

      const homeLineup =
        getSbLineup(match.homeTeam.id) ??
        getDbLineup(match.homeTeamId)

      const awayLineup =
        getSbLineup(match.awayTeam.id) ??
        getDbLineup(match.awayTeamId)

      return NextResponse.json({
        available: true,
        source: 'statsbomb-open-data',
        eventCount: statsBombEvents.length,
        passCount: statsBombEvents.filter((e) => e.type?.name === 'Pass').length,
        passingNetwork,
        teams: [
          {
            id: match.homeTeam.id,
            name: match.homeTeam.name,
            lineup: homeLineup,
          },
          {
            id: match.awayTeam.id,
            name: match.awayTeam.name,
            lineup: awayLineup,
          },
        ],
      })
    }

    // No StatsBomb events — return DB lineup only
    return NextResponse.json({
      available: false,
      reason:
        'Match-level passing and tactical data are not available for this match in the StatsBomb dataset.',
      teams: [
        {
          id: match.homeTeam.id,
          name: match.homeTeam.name,
          lineup: getSbLineup(match.homeTeam.id) ?? getDbLineup(match.homeTeamId),
        },
        {
          id: match.awayTeam.id,
          name: match.awayTeam.name,
          lineup: getSbLineup(match.awayTeam.id) ?? getDbLineup(match.awayTeamId),
        },
      ],
    })
  } catch (error) {
    console.error('Error serving tactics data:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
