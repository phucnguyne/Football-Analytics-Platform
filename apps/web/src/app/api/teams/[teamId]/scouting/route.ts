import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { generateScoutingReport, type ScoutingInput } from '@/lib/scouting-generator'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const id = parseInt(teamId)

  if (isNaN(id)) {
    return NextResponse.json({ error: 'invalid team id' }, { status: 400 })
  }

  try {
    // ── Fetch team ───────────────────────────────────────────────────────────
    const team = await prisma.team.findUnique({ where: { id } })

    if (!team) {
      return NextResponse.json({ error: 'team not found' }, { status: 404 })
    }

    // ── Fetch standing (current season, TOTAL type) ──────────────────────────
    const currentSeason = await prisma.season.findFirst({
      where: { isCurrent: true },
      orderBy: { year: 'desc' },
    })

    let standing = null
    if (currentSeason) {
      standing = await prisma.standing.findFirst({
        where: { teamId: id, seasonId: currentSeason.id, type: 'TOTAL' },
      })
    }

    // ── Fetch top players on this team (by xG, then goals) ──────────────────
    const playerTeamRows = await prisma.playerTeam.findMany({
      where: { teamId: id },
      include: {
        player: {
          include: { stats: true },
        },
      },
      take: 50, // load up to 50 and filter below
    })

    const topPlayers = playerTeamRows
      .filter(pt => pt.player.stats !== null)
      .sort((a, b) => {
        const aXG = a.player.stats?.xG ?? 0
        const bXG = b.player.stats?.xG ?? 0
        return bXG - aXG
      })
      .slice(0, 5)
      .map(pt => ({
        id:                pt.player.id,
        name:              pt.player.name,
        position:          pt.player.position as string,
        nationality:       pt.player.nationality,
        shirtNumber:       pt.shirtNumber ?? pt.player.shirtNumber,
        goals:             pt.player.stats?.goals ?? 0,
        assists:           pt.player.stats?.assists ?? 0,
        xG:                pt.player.stats?.xG ?? 0,
        xA:                pt.player.stats?.xA ?? 0,
        passCompletion:    pt.player.stats?.passCompletion ?? 0,
        tacklesPer90:      pt.player.stats?.tacklesPer90 ?? 0,
        progressivePasses: pt.player.stats?.progressivePasses ?? 0,
      }))

    // ── Fetch last 6 finished matches for this team ──────────────────────────
    const recentMatchRows = await prisma.match.findMany({
      where: {
        OR: [{ homeTeamId: id }, { awayTeamId: id }],
        status: 'FINISHED',
      },
      include: {
        homeTeam: { select: { id: true, name: true, crest: true } },
        awayTeam:  { select: { id: true, name: true, crest: true } },
        score: true,
      },
      orderBy: { utcDate: 'desc' },
      take: 6,
    })

    const recentMatches = recentMatchRows.map(m => ({
      matchday:       m.matchday,
      utcDate:        m.utcDate.toISOString(),
      homeTeamId:     m.homeTeamId,
      homeTeamName:   m.homeTeam.name,
      homeTeamCrest:  m.homeTeam.crest,
      awayTeamName:   m.awayTeam.name,
      awayTeamCrest:  m.awayTeam.crest,
      homeGoals:      m.score?.homeTeamGoals ?? null,
      awayGoals:      m.score?.awayTeamGoals ?? null,
    }))

    // ── Build input and generate report ─────────────────────────────────────
    const input: ScoutingInput = {
      team: {
        id:        team.id,
        name:      team.name,
        shortName: team.shortName,
        crest:     team.crest,
        venue:     team.venue,
        founded:   team.founded,
      },
      standing: standing
        ? {
            position:       standing.position,
            points:         standing.points,
            wins:           standing.wins,
            draws:          standing.draws,
            losses:         standing.losses,
            goalsFor:       standing.goalsFor,
            goalsAgainst:   standing.goalsAgainst,
            goalDifference: standing.goalDifference,
            playedGames:    standing.playedGames,
          }
        : null,
      topPlayers,
      recentMatches,
    }

    const report = generateScoutingReport(input)

    return NextResponse.json(report, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Scouting API error:', error)

    // Graceful degradation — return mocked report even if DB is down
    const { generateScoutingReport: gen } = await import('@/lib/scouting-generator')
    const fallback = gen({
      team: { id, name: `Team ${id}`, shortName: `T${id}` },
    })
    return NextResponse.json(fallback)
  }
}

