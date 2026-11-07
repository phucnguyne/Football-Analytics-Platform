import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { generateComparisonVerdict, getPlayerStyleTags } from '@/lib/player-analytics'
import { env } from '@/lib/env'
import { getPlayerSeasonMetricsForTeam, type PlayerSeasonMetrics } from '@/lib/api-football'

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
      teams: { include: { team: true } },
    },
  })

  if (player) return player

  const response = await fetch(`${env.FOOTBALL_DATA_API_URL}/persons/${id}`, {
    headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
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

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, shortName: true, crest: true },
  })
  if (team) return team

  const response = await fetch(`${env.FOOTBALL_DATA_API_URL}/teams/${teamId}`, {
    headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
    next: { revalidate: 3600 },
  })
  if (!response.ok) return fallback

  const data = await response.json() as ComparisonTeam
  return data.name ? data : fallback
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const p1Str = searchParams.get('p1')
  const p2Str = searchParams.get('p2')

  const p1Id = p1Str ? parseInt(p1Str) : NaN
  const p2Id = p2Str ? parseInt(p2Str) : NaN
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

    if (!p1 || !p2) {
      return NextResponse.json({ error: 'one or both players not found' }, { status: 404 })
    }

    type DatabaseComparisonStats = NonNullable<typeof p1.stats> &
      Pick<PlayerSeasonMetrics, 'savesPer90' | 'savePercentage'>
    type ComparisonStats = PlayerSeasonMetrics | DatabaseComparisonStats | null
    const withDatabaseMetrics = (stats: typeof p1.stats): ComparisonStats =>
      stats ? { ...stats, savesPer90: null, savePercentage: null } : null
    let player1Stats: ComparisonStats = withDatabaseMetrics(p1.stats)
    let player2Stats: ComparisonStats = withDatabaseMetrics(p2.stats)
    let statsSource: 'API-Football' | 'database' | null = null
    let statsSeason: number | null = null

    const requestedTeamIds = [p1TeamId, p2TeamId].filter((id) =>
      Number.isInteger(id) && id > 0,
    )
    const selectedTeams = requestedTeamIds.length
      ? await prisma.team.findMany({
          where: { id: { in: requestedTeamIds } },
          select: { id: true, name: true },
        })
      : []
    const team1 = await getTeamForComparison(
      p1TeamId,
      selectedTeams.find((team) => team.id === p1TeamId) ??
        p1.teams[0]?.team,
    )
    const team2 = await getTeamForComparison(
      p2TeamId,
      selectedTeams.find((team) => team.id === p2TeamId) ??
        p2.teams[0]?.team,
    )
    const team1Name = team1?.name
    const team2Name = team2?.name
    const configuredSeason = env.API_FOOTBALL_SEASON ?? new Date().getFullYear()
    const availableSeasons = configuredSeason >= 2022 && configuredSeason <= 2024
      ? [...new Set([configuredSeason, 2024, 2023, 2022])]
      : [2024, 2023, 2022]

    if (team1Name && team2Name) {
      for (const season of availableSeasons) {
        const [apiFootballStats1, apiFootballStats2] = await Promise.all([
          getPlayerSeasonMetricsForTeam(p1.name, team1Name, season),
          getPlayerSeasonMetricsForTeam(p2.name, team2Name, season),
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

    if (!statsSource && p1.stats && p2.stats) {
      statsSource = 'database'
    } else if (!statsSource) {
      player1Stats = null
      player2Stats = null
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
      statsSeason,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Error comparing players:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'internal error' },
      { status: 502 },
    )
  }
}
