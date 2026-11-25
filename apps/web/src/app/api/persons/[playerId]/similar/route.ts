import { isPlaceholderPlayerName } from '@/lib/data-source'
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

    if (!target || isPlaceholderPlayerName(target.name)) {
      return NextResponse.json({ error: 'player not found' }, { status: 404 })
    }
    if (target.stats?.dataSource !== 'REAL' || !target.stats.seasonId) {
      return NextResponse.json({ similarPlayers: [], statsProvenance: 'unavailable' })
    }

    // Compare players in the same position group and season.
    const candidates = await prisma.player.findMany({
      where: {
        id: { not: id },
        position: target.position,
        stats: { is: { seasonId: target.stats.seasonId, dataSource: 'REAL', matchesPlayed: { gt: 0 } } },
      },
      include: {
        stats: true,
        teams: { include: { team: true } },
      },
      orderBy: [{ stats: { matchesPlayed: 'desc' } }, { id: 'asc' }],
      take: 40,
    })

    const scored = candidates
      .filter((c) => c.stats && !isPlaceholderPlayerName(c.name))
      .flatMap((c) => {
        const similarity = calculateCosineSimilarity(target.stats, c.stats)
        if (similarity === null) return []
        const team = c.teams.find(({ to }) => to === null)?.team ?? c.teams[0]?.team

        return [{
          id: c.id,
          name: c.name,
          position: c.position,
          nationality: c.nationality,
          shirtNumber: c.shirtNumber,
          team: team ? {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            crest: team.crest ?? undefined,
          } : null,
          similarityScore: similarity,
          styleTags: getPlayerStyleTags(c.stats),
          stats: {
            goals: c.stats?.goals ?? null,
            assists: c.stats?.assists ?? null,
            xG: c.stats?.xG ?? null,
            xA: c.stats?.xA ?? null,
            passCompletion: c.stats?.passCompletion ?? null,
            progressivePasses: c.stats?.progressivePasses ?? null,
            tacklesPer90: c.stats?.tacklesPer90 ?? null,
          },
        }]
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
      statsProvenance: scored.length ? 'real' : 'unavailable',
    })
  } catch (error) {
    console.error('Error fetching similar players:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

