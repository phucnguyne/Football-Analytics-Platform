import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { getPlayerMatches, resolveApiFootballPlayerId } from '@/lib/api-football'

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
        stats: true,
      },
    })

    if (!player) {
      return NextResponse.json({ error: 'player not found' }, { status: 404 })
    }

    const apiPlayerId = await resolveApiFootballPlayerId(player.id, player.name)
    if (apiPlayerId) {
      const providerMatches = await getPlayerMatches(apiPlayerId)
      if (providerMatches.length > 0) {
        const matches = providerMatches.slice(-10).map((match, index) => {
          const home = match.teams?.home
          const away = match.teams?.away
          const isHome = true
          const winner = home?.winner ? home.id : away?.winner ? away.id : null
          const result = winner == null ? 'D' : winner === (isHome ? home?.id : away?.id) ? 'W' : 'L'
          const goals = match.goals?.total ?? 0
          const assists = match.goals?.assists ?? 0
          const rating = Number(match.rating ?? 0) || 0
          return {
            matchId: match.fixture?.id ?? index,
            date: match.fixture?.date?.split('T')[0] ?? new Date().toISOString().split('T')[0],
            opponent: {
              id: (isHome ? away?.id : home?.id) ?? 0,
              name: (isHome ? away?.name : home?.name) ?? 'Opponent',
              shortName: (isHome ? away?.name : home?.name) ?? 'Opponent',
            },
            isHome,
            result,
            score: `${isHome ? goals : 0} - ${isHome ? 0 : goals}`,
            minutes: match.minutes ?? 0,
            rating,
            goals,
            assists,
            xG: 0,
            xA: 0,
            keyPasses: match.passes?.key ?? 0,
            tackles: match.tackles?.total ?? 0,
          }
        })
        const rated = matches.filter((match) => match.rating > 0)
        const average = rated.length > 0 ? rated.reduce((sum, match) => sum + match.rating, 0) / rated.length : 0
        const last5 = matches.slice(-5)
        return NextResponse.json({
          matches,
          summary: {
            avgRating: +average.toFixed(2),
            trend: 'STABLE',
            formBadge: 'API-Football match data',
            last5Rating: +(last5.reduce((sum, match) => sum + match.rating, 0) / Math.max(1, last5.length)).toFixed(2),
            totalGoalsLast5: last5.reduce((sum, match) => sum + match.goals, 0),
            totalAssistsLast5: last5.reduce((sum, match) => sum + match.assists, 0),
          },
          source: 'api-football',
        })
      }
    }

    return NextResponse.json({
      matches: [],
      summary: {
        avgRating: 0,
        trend: 'STABLE',
        formBadge: 'Match-by-match data unavailable',
        last5Rating: 0,
        totalGoalsLast5: 0,
        totalAssistsLast5: 0,
      },
      source: 'unavailable',
    })
  } catch (error) {
    console.error('Error fetching player form:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

