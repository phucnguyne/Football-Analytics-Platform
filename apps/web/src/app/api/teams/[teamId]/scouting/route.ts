import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { isPlaceholderPlayerName } from '@/lib/data-source'
import type { ScoutingReportData } from '@/lib/scouting-report'

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const id = Number((await params).teamId)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid team id' }, { status: 400 })
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id }, select: { name: true, crest: true, venue: true, founded: true },
    })
    if (!team) return NextResponse.json({ error: 'team not found' }, { status: 404 })

    const [standing, matches] = await Promise.all([
      prisma.standing.findFirst({
        where: { teamId: id, type: 'TOTAL', season: { isCurrent: true } },
        orderBy: [{ season: { year: 'desc' } }, { seasonId: 'asc' }, { id: 'asc' }],
        select: {
          seasonId: true, season: { select: { year: true, league: { select: { name: true } } } },
          position: true, points: true, updatedAt: true, playedGames: true, wins: true, draws: true,
          losses: true, goalsFor: true, goalsAgainst: true,
        },
      }),
      prisma.match.findMany({
        where: { status: 'FINISHED', score: { isNot: null }, OR: [{ homeTeamId: id }, { awayTeamId: id }] },
        select: {
          id: true, utcDate: true, homeTeamId: true, league: { select: { name: true } },
          homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
          score: { select: { homeTeamGoals: true, awayTeamGoals: true, winner: true } },
        },
        orderBy: [{ utcDate: 'desc' }, { id: 'desc' }],
        take: 6,
      }),
    ])
    const current = standing ?? await prisma.teamSeason.findFirst({
      where: { teamId: id, season: { isCurrent: true } },
      select: { seasonId: true, season: { select: { year: true } } },
      orderBy: [{ season: { year: 'desc' } }, { seasonId: 'asc' }],
    })
    const seasonId = current?.seasonId
    const players = seasonId ? await prisma.playerStats.findMany({
      where: {
        seasonId, dataSource: 'REAL', matchesPlayed: { gt: 0 },
        player: { teams: { some: { teamId: id }, none: { teamId: { not: id } } } },
      },
      orderBy: [{ goals: 'desc' }, { assists: 'desc' }, { playerId: 'asc' }],
      select: { player: { select: { id: true, name: true } }, matchesPlayed: true, goals: true, assists: true },
    }) : []

    const report: ScoutingReportData = {
      id, teamName: team.name, crest: team.crest, venue: team.venue, founded: team.founded,
      standing: standing ? {
        league: standing.season.league.name, year: standing.season.year, updatedAt: standing.updatedAt.toISOString(),
        position: standing.position, points: standing.points, playedGames: standing.playedGames,
        wins: standing.wins, draws: standing.draws, losses: standing.losses,
        goalsFor: standing.goalsFor, goalsAgainst: standing.goalsAgainst,
      } : null,
      recentForm: matches.flatMap((match) => {
        if (!match.score) return []
        const isHome = match.homeTeamId === id
        const goalsFor = isHome ? match.score.homeTeamGoals : match.score.awayTeamGoals
        const goalsAgainst = isHome ? match.score.awayTeamGoals : match.score.homeTeamGoals
        const winner = match.score.winner
        return [{
          id: match.id, date: match.utcDate.toISOString(), competition: match.league.name, isHome,
          opponent: isHome ? match.awayTeam.name : match.homeTeam.name,
          goalsFor, goalsAgainst,
          result: winner === 'DRAW' ? 'D' : winner ? ((winner === 'HOME') === isHome ? 'W' : 'L') :
            goalsFor === goalsAgainst ? 'D' : goalsFor > goalsAgainst ? 'W' : 'L',
        }]
      }),
      keyPlayers: players.filter(({ player }) => !isPlaceholderPlayerName(player.name)).slice(0, 5)
        .map(({ player, goals, assists, matchesPlayed }) => ({ ...player, goals, assists, matchesPlayed })),
      playerStatsSeason: current?.season.year ?? null,
    }
    return NextResponse.json(report, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Scouting API error:', error)
    return NextResponse.json({ error: 'scouting data unavailable' }, { status: 503 })
  }
}
