import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { calculateCosineSimilarity, getPlayerStyleTags } from '@/lib/player-analytics'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params
  const id = parseInt(playerId)

  if (isNaN(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  try {
    const target = await prisma.player.findUnique({
      where: { id },
      include: {
        stats: true,
        teams: { include: { team: true } },
      },
    })

    if (!target || !target.stats) {
      return NextResponse.json({ error: 'player or stats not found' }, { status: 404 })
    }

    // Query players with stats in the same position group (or across position)
    const candidates = await prisma.player.findMany({
      where: {
        id: { not: id },
        position: target.position,
        stats: { isNot: null },
      },
      include: {
        stats: true,
        teams: { include: { team: true } },
      },
      take: 40,
    })

    const scored = candidates
      .filter((c) => c.stats)
      .map((c) => {
        const similarity = calculateCosineSimilarity(target.stats, c.stats)
        const team = c.teams[0]?.team || { id: 0, name: 'Free Agent', shortName: 'FA' }

        return {
          id: c.id,
          name: c.name,
          position: c.position,
          nationality: c.nationality,
          shirtNumber: c.shirtNumber,
          team: {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            crest: team.crest ?? undefined,
          },
          similarityScore: similarity,
          styleTags: getPlayerStyleTags(c.stats),
          stats: {
            goals: c.stats?.goals ?? 0,
            assists: c.stats?.assists ?? 0,
            xG: c.stats?.xG ?? 0,
            xA: c.stats?.xA ?? 0,
            passCompletion: c.stats?.passCompletion ?? 0,
            progressivePasses: c.stats?.progressivePasses ?? 0,
            tacklesPer90: c.stats?.tacklesPer90 ?? 0,
          },
        }
      })
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 5)

    return NextResponse.json({
      targetPlayer: {
        id: target.id,
        name: target.name,
        position: target.position,
      },
      similarPlayers: scored,
    })
  } catch (error) {
    console.error('Error fetching similar players:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

