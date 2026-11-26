import { isPlaceholderPlayerName } from '@/lib/data-source'
import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { calculateCosineSimilarity, getPlayerStyleTags } from '@/lib/player-analytics'
import { eligibleSeasonPeers, getRecordedPlayerSeason } from '@/lib/player-seasons'

export async function GET(_request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const id = Number((await params).playerId)
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  try {
    const target = await prisma.player.findUnique({
      where: { id },
      include: { stats: true, teams: { where: { to: null }, orderBy: { from: 'desc' }, take: 1 } },
    })
    if (!target || isPlaceholderPlayerName(target.name)) {
      return NextResponse.json({ error: 'player not found' }, { status: 404 })
    }
    const legacy = target.stats?.dataSource === 'REAL' && target.stats.seasonId ? target.stats : null
    const recorded = legacy ? null : await getRecordedPlayerSeason(target, target.teams[0]?.teamId)
    const stats = legacy ?? recorded?.target.stats
    if (!stats) return NextResponse.json({ similarPlayers: [], statsProvenance: 'unavailable' })

    const legacyCandidates = legacy ? await prisma.player.findMany({
      where: {
        id: { not: id }, position: target.position,
        stats: { is: { seasonId: legacy.seasonId, dataSource: 'REAL', minutesPlayed: { gte: 270 } } },
      },
      include: { stats: true, teams: { include: { team: true } } },
      orderBy: [{ stats: { minutesPlayed: 'desc' } }, { id: 'asc' }],
    }) : []
    const cohort = recorded ? eligibleSeasonPeers(recorded.cohort, id)
      : legacyCandidates.flatMap((player) => player.stats && !isPlaceholderPlayerName(player.name)
        ? [{ player, stats: player.stats, team: player.teams.find(({ to }) => to === null)?.team ?? player.teams[0]?.team }]
        : [])

    const similarPlayers = cohort.flatMap(({ player, team, stats: candidate }) => {
      const similarityScore = calculateCosineSimilarity(stats, candidate)
      if (similarityScore === null) return []
      return [{
        id: player.id, name: player.name, position: player.position,
        nationality: player.nationality, shirtNumber: player.shirtNumber,
        team: team ? { id: team.id, name: team.name, shortName: team.shortName, crest: team.crest } : null,
        similarityScore,
        styleTags: getPlayerStyleTags(candidate),
        stats: {
          goals: candidate.goals, assists: candidate.assists, xG: candidate.xG, xA: candidate.xA,
          passCompletion: candidate.passCompletion, progressivePasses: candidate.progressivePasses,
          tacklesPer90: candidate.tacklesPer90,
        },
      }]
    }).sort((a, b) => b.similarityScore - a.similarityScore || a.id - b.id).slice(0, 5)

    return NextResponse.json({
      targetPlayer: { id, name: target.name, position: target.position },
      similarPlayers,
      statsSeason: recorded?.season ?? null,
      statsSource: recorded?.source ?? 'database',
      statsProvenance: similarPlayers.length ? 'real' : 'unavailable',
    }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (error) {
    console.error('Error fetching similar players:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
