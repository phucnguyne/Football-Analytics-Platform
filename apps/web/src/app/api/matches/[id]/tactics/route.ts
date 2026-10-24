import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'

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

    const getLineup = (teamId: number) =>
      match.lineups
        .filter((lineup) => lineup.teamId === teamId)
        .map((lineup) => ({
          id: lineup.player.id,
          name: lineup.player.name,
          shirtNumber: lineup.shirtNumber ?? lineup.player.shirtNumber,
          position: lineup.position,
          isStarter: lineup.isStarter,
        }))

    return NextResponse.json({
      available: false,
      reason:
        'Match-level passing, player-position, and defensive-action data are not available from the configured data source.',
      teams: [
        {
          id: match.homeTeam.id,
          name: match.homeTeam.name,
          lineup: getLineup(match.homeTeamId),
        },
        {
          id: match.awayTeam.id,
          name: match.awayTeam.name,
          lineup: getLineup(match.awayTeamId),
        },
      ],
    })
  } catch (error) {
    console.error('Error serving tactics data:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
