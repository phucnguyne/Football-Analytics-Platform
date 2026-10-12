import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { generateTacticalData } from '@/lib/tactics-generator'

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
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        lineups: {
          include: { player: true, team: true },
        },
      },
    })

    if (!match) {
      // Return synthetic tactical insights for non-DB matches as fallback
      const fallbackTactics = generateTacticalData(
        matchId,
        { id: 1, name: 'Home Team', shortName: 'Home' },
        { id: 2, name: 'Away Team', shortName: 'Away' }
      )
      return NextResponse.json(fallbackTactics)
    }

    const homeLineup = match.lineups
      .filter((l) => l.teamId === match.homeTeamId)
      .map((l) => ({
        id: l.player.id,
        name: l.player.name,
        shirtNumber: l.shirtNumber,
        position: l.position,
        isStarter: l.isStarter,
      }))

    const awayLineup = match.lineups
      .filter((l) => l.teamId === match.awayTeamId)
      .map((l) => ({
        id: l.player.id,
        name: l.player.name,
        shirtNumber: l.shirtNumber,
        position: l.position,
        isStarter: l.isStarter,
      }))

    const tactics = generateTacticalData(
      matchId,
      {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        shortName: match.homeTeam.shortName,
        crest: match.homeTeam.crest ?? undefined,
        lineup: homeLineup,
      },
      {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        shortName: match.awayTeam.shortName,
        crest: match.awayTeam.crest ?? undefined,
        lineup: awayLineup,
      }
    )

    return NextResponse.json(tactics)
  } catch (error) {
    console.error('Error serving tactics data:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

