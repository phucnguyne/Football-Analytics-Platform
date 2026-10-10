import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params
  const id = parseInt(playerId)

  if (isNaN(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  try {
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        teams: { include: { team: true } },
        stats: true,
      }
    })

    if (!player) {
      // Proxy to upstream if not found in our DB
      const res = await fetch(
        `${process.env.FOOTBALL_DATA_API_URL}/persons/${playerId}`,
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
      )
      if (!res.ok) return NextResponse.json({ error: 'not found' }, { status: res.status })
      return NextResponse.json(await res.json())
    }

    // Get positional averages for comparison
    const positionalStats = await prisma.playerStats.aggregate({
      where: { player: { position: player.position }, matchesPlayed: { gt: 5 } },
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
    })

    const response = {
      id: player.id,
      name: player.name,
      position: player.position,
      dateOfBirth: player.dateOfBirth,
      nationality: player.nationality,
      shirtNumber: player.shirtNumber,
      teams: player.teams.map(t => ({
        id: t.team.id,
        name: t.team.name,
        shortName: t.team.shortName,
        crest: t.team.crest,
      })),
      stats: player.stats,
      positionalAverages: positionalStats._avg
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching player:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
