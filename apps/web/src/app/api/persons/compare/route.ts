import { fetchProvider, measureProviderCalls } from '@/lib/provider-timing'
import { isPlaceholderPlayerName } from '@/lib/data-source'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { generateComparisonVerdict, getPlayerStyleTags } from '@/lib/player-analytics'
import { env } from '@/lib/env'
import { apiFootballSeasonYear, getPlayerSeasonMetricsForTeam, type PlayerSeasonMetrics } from '@/lib/api-football'

interface ProviderPerson {
  id: number
  name: string
  position?: string | null
  section?: string | null
  dateOfBirth?: string | null
  nationality?: string | null
  shirtNumber?: number | null
  photo?: string | null
  currentTeam?: {
    id: number
    name: string
    shortName?: string | null
    crest?: string | null
  } | null
}

async function getPlayer(id: number) {
  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      stats: true,
      teams: { include: { team: true }, orderBy: [{ to: { sort: 'desc', nulls: 'first' } }, { from: { sort: 'desc', nulls: 'last' } }] },
    },
  })

  if (player) return player

  const response = await fetchProvider(`${env.FOOTBALL_DATA_API_URL}/persons/${id}`, {
    redirect: "error",    headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
    next: { revalidate: 3600 },
  })
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`Player provider request failed (${response.status})`)
  }

  const person = (await response.json()) as ProviderPerson
  return {
    id: person.id,
    name: person.name,
    position: person.position ?? person.section ?? 'Unknown',
    dateOfBirth: person.dateOfBirth,
    nationality: person.nationality,
    shirtNumber: person.shirtNumber,
    photo: person.photo,
    stats: null,
    teams: person.currentTeam
      ? [{
          team: {
            id: person.currentTeam.id,
            name: person.currentTeam.name,
            shortName: person.currentTeam.shortName ?? person.currentTeam.name,
            crest: person.currentTeam.crest ?? null,
          },
        }]
      : [],
  }
}

type ComparisonTeam = {
  id: number
  name: string
  shortName?: string | null
  crest?: string | null
}

async function getTeamForComparison(
  teamId: number,
  fallback?: ComparisonTeam,
): Promise<ComparisonTeam | undefined> {
  if (!Number.isInteger(teamId) || teamId <= 0) return fallback
  if (fallback?.id === teamId) return fallback

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, shortName: true, crest: true },
  })
  if (team) return team

  const response = await fetchProvider(`${env.FOOTBALL_DATA_API_URL}/teams/${teamId}`, {
    redirect: "error",    headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
    next: { revalidate: 3600 },
  })
  if (!response.ok) return undefined

  const data = await response.json() as ComparisonTeam
  return data.id === teamId && data.name ? data : undefined
}

export function GET(req: NextRequest) {
  return measureProviderCalls(() => load(req))
}

async function load(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const p1Str = searchParams.get('p1')
  const p2Str = searchParams.get('p2')

  const p1Id = Number(p1Str)
  const p2Id = Number(p2Str)
  const p1TeamId = Number(searchParams.get('p1TeamId'))
  const p2TeamId = Number(searchParams.get('p2TeamId'))

  if (!Number.isInteger(p1Id) || !Number.isInteger(p2Id) || p1Id <= 0 || p2Id <= 0) {
    return NextResponse.json({ error: 'both p1 and p2 are required and must be valid integers' }, { status: 400 })
  }

  try {
    const [p1, p2] = await Promise.all([
      getPlayer(p1Id),
      getPlayer(p2Id),
    ])

    if (!p1 || !p2 || isPlaceholderPlayerName(p1.name) || isPlaceholderPlayerName(p2.name)) {
      return NextResponse.json({ error: 'one or both players not found' }, { status: 404 })
    }

    type DatabaseComparisonStats = NonNullable<typeof p1.stats> &
      Pick<PlayerSeasonMetrics, 'savesPer90' | 'savePercentage'>
    type ComparisonStats = PlayerSeasonMetrics | DatabaseComparisonStats | null
    let player1Stats: ComparisonStats = null
    let player2Stats: ComparisonStats = null
    let statsSource: 'API-Football' | 'database' | null = null
    let statsSeason: number | null = null

    const [team1, team2] = await Promise.all([
      getTeamForComparison(p1TeamId, p1.teams[0]?.team),
      getTeamForComparison(p2TeamId, p2.teams[0]?.team),
    ])
    if ((p1TeamId && !team1) || (p2TeamId && !team2)) {
      return NextResponse.json({ error: 'selected team not found' }, { status: 404 })
    }
    const team1Name = team1?.name
    const team2Name = team2?.name
    const season = apiFootballSeasonYear()
    const availableSeasons = env.API_FOOTBALL_SEASON ? [season] : [season, season - 1]

    if (team1 && team2) {
      const snapshots = await prisma.playerSeasonSnapshot.findMany({
        where: { OR: [{ playerId: p1Id, teamId: team1.id }, { playerId: p2Id, teamId: team2.id }] },
        select: { playerId: true, seasonId: true, season: { select: { year: true } }, metrics: true },
        orderBy: [{ season: { year: 'desc' } }, { seasonId: 'asc' }],
      })
      for (const first of snapshots.filter(({ playerId }) => playerId === p1Id)) {
        const second = snapshots.find(({ playerId, seasonId }) => playerId === p2Id && seasonId === first.seasonId)
        if (!second) continue
        player1Stats = first.metrics as unknown as PlayerSeasonMetrics
        player2Stats = second.metrics as unknown as PlayerSeasonMetrics
        statsSource = 'API-Football'
        statsSeason = first.season.year
        break
      }
    }
    if (!statsSource && team1Name && team2Name) {
      for (const season of availableSeasons) {
        const [apiFootballStats1, apiFootballStats2] = await Promise.all([
          getPlayerSeasonMetricsForTeam(p1.name, team1Name, season).catch(() => null),
          getPlayerSeasonMetricsForTeam(p2.name, team2Name, season).catch(() => null),
        ])
        if (apiFootballStats1 && apiFootballStats2) {
          player1Stats = apiFootballStats1
          player2Stats = apiFootballStats2
          statsSource = 'API-Football'
          statsSeason = season
          break
        }
      }
    }

    if (!statsSource && p1.stats?.dataSource === 'REAL' && p2.stats?.dataSource === 'REAL' &&
      p1.stats.seasonId && p1.stats.seasonId === p2.stats.seasonId &&
      team1 && p1.teams.length > 0 && p1.teams.every(({ team }) => team.id === team1.id) &&
      team2 && p2.teams.length > 0 && p2.teams.every(({ team }) => team.id === team2.id)) {
      statsSource = 'database'
      player1Stats = { ...p1.stats, savesPer90: null, savePercentage: null }
      player2Stats = { ...p2.stats, savesPer90: null, savePercentage: null }
      const dbSeason = await prisma.season.findUnique({ where: { id: p1.stats.seasonId }, select: { year: true } })
      statsSeason = dbSeason?.year ?? null
    }

    const formatPlayer = (
      player: Awaited<ReturnType<typeof getPlayer>>,
      stats: ComparisonStats,
      selectedTeam?: ComparisonTeam,
    ) => {
      if (!player) return null
      const team = selectedTeam ?? player.teams[0]?.team
      return {
        id: player.id,
        name: player.name,
        position: player.position,
        dateOfBirth: player.dateOfBirth,
        nationality: player.nationality,
        shirtNumber: player.shirtNumber,
        photo: player.photo,
        team: team
          ? {
              id: team.id,
              name: team.name,
              shortName: team.shortName,
              crest: team.crest,
            }
          : null,
        stats,
        styleTags: getPlayerStyleTags(stats),
      }
    }

    const player1 = formatPlayer(p1, player1Stats, team1)
    const player2 = formatPlayer(p2, player2Stats, team2)
    const comparisonMetricKeys = [
      'xG',
      'xA',
      'matchesPlayed',
      'minutesPlayed',
      'shotsPer90',
      'passCompletion',
      'progressivePasses',
      'tacklesPer90',
      'interceptions',
      'dribblesSuccess',
      'savesPer90',
      'savePercentage',
    ] as const
    const metricsAvailable = comparisonMetricKeys.some((key) =>
      typeof player1?.stats?.[key] === 'number' &&
      typeof player2?.stats?.[key] === 'number',
    )
    const verdictMetricsAvailable = (
      ['xG', 'progressivePasses', 'tacklesPer90'] as const
    ).some((key) =>
      typeof player1?.stats?.[key] === 'number' &&
      typeof player2?.stats?.[key] === 'number',
    )
    const verdict = verdictMetricsAvailable
      ? generateComparisonVerdict(player1, player2)
      : null

    return NextResponse.json({
      player1,
      player2,
      verdict,
      metricsAvailable,
      statsSource,
      statsProvenance: statsSource ? 'real' : 'unavailable',
      statsSeason,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Error comparing players:', error)
    return NextResponse.json({ error: 'Unable to compare players' }, { status: 502 })
  }
}
