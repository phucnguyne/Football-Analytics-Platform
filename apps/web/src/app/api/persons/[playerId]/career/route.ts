import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { generateCareerStats, type CareerInput } from '@/lib/career-generator'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params
  const id = parseInt(playerId)

  if (isNaN(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  try {
    // ── Load player with team + stats from DB ────────────────────────────────
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        teams: {
          include: { team: true },
          take: 1,
          orderBy: { from: 'desc' },
        },
        stats: true,
      },
    })

    if (!player) {
      return NextResponse.json({ error: 'player not found' }, { status: 404 })
    }

    const currentTeam = player.teams[0]?.team ?? null
    const stats = player.stats

    const input: CareerInput = {
      playerId: id,
      position: player.position as string,
      currentTeam: currentTeam
        ? {
            id:        currentTeam.id,
            name:      currentTeam.name,
            shortName: currentTeam.shortName,
            crest:     currentTeam.crest ?? undefined,
          }
        : null,
      currentStats: stats
        ? {
            matchesPlayed: stats.matchesPlayed,
            minutesPlayed: stats.minutesPlayed,
            goals:         stats.goals,
            assists:       stats.assists,
            yellowCards:   stats.yellowCards,
            redCards:      stats.redCards,
            xG:            stats.xG ?? 0,
            xA:            stats.xA ?? 0,
          }
        : null,
    }

    const career = generateCareerStats(input)

    return NextResponse.json(career, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Career API error:', error)

    // Graceful fallback — generate mocked career even if DB is down
    const fallback = generateCareerStats({ playerId: id, position: 'MIDFIELDER' })
    return NextResponse.json(fallback)
  }
}

