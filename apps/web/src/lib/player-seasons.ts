import prisma from '@app/database/src/client'
import type { Player, PlayerMatchStat } from '@app/database'
import type { PlayerSeasonMetrics } from '@/lib/api-football'
import type { PlayerPerformanceStats } from '@/lib/player-analytics'
import { isPlaceholderPlayerName } from '@/lib/data-source'

const metrics = ['xG', 'xA', 'shotsPer90', 'passCompletion', 'progressivePasses',
  'tacklesPer90', 'interceptions', 'dribblesSuccess'] as const
const minimumMinutes = 90
const round = (value: number) => Math.round(value * 100) / 100
const clubSelect = { id: true, name: true, shortName: true, crest: true } as const
const playerSelect = { id: true, name: true, position: true, nationality: true, shirtNumber: true } as const

interface CohortPlayer {
  player: Pick<Player, 'id' | 'name' | 'position' | 'nationality' | 'shirtNumber'>
  team: { id: number; name: string; shortName: string; crest: string | null } | undefined
  stats: PlayerSeasonMetrics
}

function aggregateMatches(matches: PlayerMatchStat[]): PlayerSeasonMetrics {
  const minutes = matches.reduce((sum, row) => sum + row.minutes, 0)
  type Count = 'goals' | 'assists' | 'shots' | 'tackles' | 'interceptions' | 'xG' | 'xA' |
    'passes' | 'passesCompleted' | 'dribbles' | 'dribblesCompleted'
  const total = (key: Count) => matches.every((row) => row[key] !== null)
    ? matches.reduce((sum, row) => sum + (row[key] ?? 0), 0) : null
  const per90 = (key: Count) => {
    const value = total(key)
    return value !== null && minutes > 0 ? round(value * 90 / minutes) : null
  }
  const percentage = (numerator: Count, denominator: Count) => {
    const made = total(numerator)
    const attempted = total(denominator)
    return made !== null && attempted !== null && attempted > 0 && made <= attempted
      ? round(made * 100 / attempted) : null
  }
  return {
    matchesPlayed: matches.length, minutesPlayed: minutes, goals: total('goals'), assists: total('assists'),
    xG: per90('xG'), xA: per90('xA'), shotsPer90: per90('shots'), tacklesPer90: per90('tackles'),
    interceptions: per90('interceptions'), passCompletion: percentage('passesCompleted', 'passes'),
    dribblesSuccess: percentage('dribblesCompleted', 'dribbles'), progressivePasses: null,
    savesPer90: null, savePercentage: null,
  }
}

export async function getRecordedPlayerSeason(
  player: Pick<Player, 'id' | 'position'>, preferredTeamId?: number,
) {
  const [match, snapshots] = await Promise.all([
    prisma.playerMatchStat.findFirst({
      where: { playerId: player.id, source: 'HIGHLIGHTLY', match: { seasonId: { not: null }, status: 'FINISHED' } },
      select: { match: { select: { seasonId: true, season: { select: { year: true } } } } },
      orderBy: [{ match: { utcDate: 'desc' } }, { matchId: 'desc' }],
    }),
    prisma.playerSeasonSnapshot.findMany({
      where: { playerId: player.id },
      select: { teamId: true, seasonId: true, season: { select: { year: true } }, metrics: true },
      orderBy: [{ season: { year: 'desc' } }, { seasonId: 'asc' }, { teamId: 'asc' }],
    }),
  ])
  const latestSnapshotYear = snapshots[0]?.season.year
  const selected = snapshots.filter((row) => row.season.year === latestSnapshotYear).sort((a, b) =>
    Number(b.teamId === preferredTeamId) - Number(a.teamId === preferredTeamId) ||
    ((b.metrics as unknown as PlayerSeasonMetrics).minutesPlayed ?? 0) -
      ((a.metrics as unknown as PlayerSeasonMetrics).minutesPlayed ?? 0),
  )[0]

  if (match?.match.seasonId && match.match.season && match.match.season.year >= (latestSnapshotYear ?? 0)) {
    const seasonId = match.match.seasonId
    const rows = await prisma.playerMatchStat.findMany({
      where: { source: 'HIGHLIGHTLY', match: { seasonId, status: 'FINISHED' }, player: { position: player.position } },
      include: { player: { select: playerSelect }, match: { select: { homeTeam: { select: clubSelect }, awayTeam: { select: clubSelect } } } },
    })
    const byPlayer = new Map<number, typeof rows>()
    for (const row of rows) {
      const group = byPlayer.get(row.playerId) ?? []
      group.push(row)
      byPlayer.set(row.playerId, group)
    }
    const cohort = [...byPlayer.values()].map((group): CohortPlayer => {
      const first = group[0]
      const clubMinutes = new Map<number, { team: CohortPlayer['team']; minutes: number }>()
      for (const row of group) {
        const team = row.teamId === row.match.homeTeam.id ? row.match.homeTeam : row.match.awayTeam
        clubMinutes.set(team.id, { team, minutes: (clubMinutes.get(team.id)?.minutes ?? 0) + row.minutes })
      }
      const team = [...clubMinutes.values()].sort((a, b) => b.minutes - a.minutes)[0]?.team
      return { player: first.player, team, stats: aggregateMatches(group) }
    })
    const target = cohort.find((entry) => entry.player.id === player.id)
    if (target) return { source: 'highlightly' as const, season: match.match.season.year, target, cohort }
  }

  if (!selected) return null
  const rows = await prisma.playerSeasonSnapshot.findMany({
    where: { seasonId: selected.seasonId, player: { position: player.position } },
    select: { team: { select: clubSelect }, player: { select: playerSelect }, metrics: true },
    orderBy: [{ playerId: 'asc' }, { teamId: 'asc' }],
  })
  const bestByPlayer = new Map<number, CohortPlayer>()
  for (const row of rows) {
    if (row.player.id === player.id && row.team.id !== selected.teamId) continue
    const stats = row.metrics as unknown as PlayerSeasonMetrics
    const previous = bestByPlayer.get(row.player.id)
    if (!previous || (stats.minutesPlayed ?? 0) > (previous.stats.minutesPlayed ?? 0)) {
      bestByPlayer.set(row.player.id, { player: row.player, team: row.team, stats })
    }
  }
  const target = bestByPlayer.get(player.id)
  if (!target) return null
  return { source: 'api-football' as const, season: selected.season.year, target, cohort: [...bestByPlayer.values()] }
}

export function eligibleSeasonPeers(rows: CohortPlayer[], playerId: number) {
  return rows.filter(({ player, stats }) => player.id !== playerId && !isPlaceholderPlayerName(player.name) &&
    (stats.minutesPlayed ?? 0) >= minimumMinutes)
}

export function getPositionalAverages(rows: CohortPlayer[]): PlayerPerformanceStats {
  return Object.fromEntries(metrics.map((metric) => {
    const values = rows.flatMap(({ stats }) => typeof stats[metric] === 'number' ? [stats[metric]] : [])
    return [metric, values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null]
  }))
}
