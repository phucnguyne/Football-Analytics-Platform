import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { getFixturePlayerPerformance, resolveApiFootballFixtureId, resolveApiFootballPlayerId } from '@/lib/api-football'
import { isPlaceholderPlayerName } from '@/lib/data-source'
import { env } from '@/lib/env'
import type { FormMatch } from '@/lib/player-analytics'
import { readStatsBombEvents } from '@/lib/statsbomb'

function average(values: number[]) {
  return values.length ? Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2)) : null
}

function formResponse(matches: FormMatch[], source: 'api-football' | 'statsbomb-open-data' | 'unavailable') {
  const lastFive = matches.slice(-5)
  const ratings = matches.flatMap(({ rating }) => rating === null ? [] : [rating])
  const difference = ratings.length > 1 ? ratings[ratings.length - 1] - ratings[0] : null
  const total = (key: 'goals' | 'assists') =>
    lastFive.length && lastFive.every((match) => match[key] !== null)
      ? lastFive.reduce((sum, match) => sum + (match[key] ?? 0), 0) : null

  return NextResponse.json({
    matches,
    summary: {
      avgRating: average(ratings),
      trend: difference === null ? null : difference > 0.2 ? 'UP' : difference < -0.2 ? 'DOWN' : 'STABLE',
      last5Rating: average(lastFive.flatMap(({ rating }) => rating === null ? [] : [rating])),
      totalGoalsLast5: total('goals'),
      totalAssistsLast5: total('assists'),
    },
    source,
  })
}

export async function GET(_request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const id = Number((await params).playerId)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  try {
    const player = await prisma.player.findUnique({
      where: { id },
      select: { name: true, apiFootballId: true, teams: { where: { to: null }, select: { teamId: true } } },
    })
    if (player && isPlaceholderPlayerName(player.name)) {
      return NextResponse.json({ error: 'player not found' }, { status: 404 })
    }

    let playerName = player?.name
    const teamIds = player?.teams.map(({ teamId }) => teamId) ?? []
    if (!playerName) {
      const upstream = await fetch(`${env.FOOTBALL_DATA_API_URL}/persons/${id}`, {
        headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY }, redirect: 'error',
        next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000),
      })
      if (upstream.status === 404) return NextResponse.json({ error: 'player not found' }, { status: 404 })
      if (!upstream.ok) return NextResponse.json({ error: 'player provider unavailable' }, { status: 502 })
      const person: { name?: string; currentTeam?: { id?: number } } = await upstream.json()
      playerName = person.name
      if (person.currentTeam?.id) teamIds.push(person.currentTeam.id)
    }
    if (!playerName) return formResponse([], 'unavailable')
    const matches = await prisma.match.findMany({
      where: {
        status: 'FINISHED',
        OR: [
          { lineups: { some: { playerId: id } } },
          { homeTeamId: { in: teamIds } },
          { awayTeamId: { in: teamIds } },
        ],
      },
      select: {
        id: true, utcDate: true, rawData: true, apiFootballId: true,
        homeTeam: { select: { id: true, name: true, shortName: true, crest: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, crest: true } },
        score: { select: { homeTeamGoals: true, awayTeamGoals: true, winner: true } },
        lineups: { where: { playerId: id }, select: { teamId: true }, take: 1 },
      },
      orderBy: [{ utcDate: 'desc' }, { id: 'desc' }],
      take: 10,
    })
    const providerId = matches.length
      ? await resolveApiFootballPlayerId(id, playerName, player?.apiFootballId).catch(() => null)
      : null

    function matchDetails(match: typeof matches[number], isHome: boolean) {
      const opponent = isHome ? match.awayTeam : match.homeTeam
      const score = match.score
      const winner = score?.winner
      const result: FormMatch['result'] = winner === 'DRAW' ? 'D' :
        winner === 'HOME' ? (isHome ? 'W' : 'L') :
        winner === 'AWAY' ? (isHome ? 'L' : 'W') :
        score ? score.homeTeamGoals === score.awayTeamGoals ? 'D' :
          (score.homeTeamGoals > score.awayTeamGoals) === isHome ? 'W' : 'L' : null
      return {
        matchId: match.id,
        date: match.utcDate.toISOString().slice(0, 10),
        opponent: { ...opponent, crest: opponent.crest ?? undefined },
        isHome,
        result,
        score: score ? `${score.homeTeamGoals} - ${score.awayTeamGoals}` : null,
      }
    }

    if (providerId) {
      const form = await Promise.all(matches.map(async (match): Promise<FormMatch[]> => {
        try {
          const fixtureId = await resolveApiFootballFixtureId({
            localMatchId: match.id, rawData: match.rawData, utcDate: match.utcDate, apiFootballId: match.apiFootballId,
            homeTeamName: match.homeTeam.name, awayTeamName: match.awayTeam.name,
          })
          if (!fixtureId) return []
          const performance = await getFixturePlayerPerformance(fixtureId, providerId, match.homeTeam.name, match.awayTeam.name)
          return performance ? [{ ...matchDetails(match, performance.isHome), ...performance, xG: null, xA: null }] : []
        } catch {
          return []
        }
      }))
      const providerMatches = form.flat().reverse()
      if (providerMatches.length) return formResponse(providerMatches, 'api-football')
    }

    const form = await Promise.all(matches.map(async (match): Promise<FormMatch[]> => {
      const teamId = match.lineups[0]?.teamId
      if (teamId !== match.homeTeam.id && teamId !== match.awayTeam.id) return []
      const events = (await readStatsBombEvents(match.id)).filter((event) =>
        event.player?.id === id && event.team?.id === teamId && (event.period ?? 1) <= 4,
      )
      if (!events.length) return []
      const shots = events.filter((event) => event.type?.name === 'Shot')
      const xG = shots.every((shot) => typeof shot.shot?.statsbomb_xg === 'number')
        ? Number(shots.reduce((sum, shot) => sum + (shot.shot?.statsbomb_xg ?? 0), 0).toFixed(2)) : null
      return [{
        ...matchDetails(match, teamId === match.homeTeam.id),
        minutes: null, rating: null,
        goals: shots.filter((event) => event.shot?.outcome?.name === 'Goal').length,
        assists: events.filter((event) => event.pass?.goal_assist).length,
        xG, xA: null,
        keyPasses: events.filter((event) => event.pass?.shot_assist || event.pass?.goal_assist).length,
        tackles: events.filter((event) => event.type?.name === 'Duel' && event.duel?.type?.name === 'Tackle').length,
      }]
    }))
    const eventMatches = form.flat().reverse()
    return formResponse(eventMatches, eventMatches.length ? 'statsbomb-open-data' : 'unavailable')
  } catch (error) {
    console.error('Error fetching player form:', error)
    return NextResponse.json({ error: 'form data unavailable' }, { status: 503 })
  }
}
