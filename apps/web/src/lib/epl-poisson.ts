import archive from '@/models/openfootball-epl-results.json'

export const FORM_HALF_LIFE_DAYS = 365
export const PRIOR_MATCHES = 6
export const PREMIER_LEAGUE_ID = 2021

const millisecondPerDay = 86_400_000
const teamAliases: Record<string, string> = {
  brighton: 'brightonhovealbion', newcastle: 'newcastleunited', manchesterutd: 'manchesterunited',
  manutd: 'manchesterunited', mancity: 'manchestercity', spurs: 'tottenhamhotspur',
  tottenham: 'tottenhamhotspur', wolves: 'wolverhamptonwanderers', wolverhampton: 'wolverhamptonwanderers',
  nottmforest: 'nottinghamforest', westham: 'westhamunited', ipswich: 'ipswichtown',
}

function teamKey(name: string) {
  const key = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/\b(football club|fc|afc|and)\b/g, '').replace(/[^a-z0-9]/g, '')
  return teamAliases[key] ?? key
}

export interface ScoredLeagueFixture {
  date: Date | string
  home: string
  away: string
  homeGoals: number
  awayGoals: number
}

const historicalTeams = archive.teams.map(teamKey)

export function fitPremierLeaguePoisson(currentResults: ScoredLeagueFixture[], asOf: Date) {
  const cutoff = Math.floor(asOf.getTime() / millisecondPerDay)
  const results = new Map<string, [number, string, string, number, number]>()
  function add(day: number, home: string, away: string, homeGoals: number, awayGoals: number) {
    if (!home || !away || !Number.isInteger(day) || day >= cutoff ||
        !Number.isInteger(homeGoals) || homeGoals < 0 || !Number.isInteger(awayGoals) || awayGoals < 0) return
    results.set(`${day}:${home}:${away}`, [day, home, away, homeGoals, awayGoals])
  }
  for (const [day, home, away, homeGoals, awayGoals] of archive.matches) {
    add(day, historicalTeams[home], historicalTeams[away], homeGoals, awayGoals)
  }
  for (const match of currentResults) {
    add(Math.floor(new Date(match.date).getTime() / millisecondPerDay), teamKey(match.home), teamKey(match.away),
      match.homeGoals, match.awayGoals)
  }
  const homeStats = new Map<string, { weight: number; scored: number; conceded: number }>()
  const awayStats = new Map<string, { weight: number; scored: number; conceded: number }>()
  function record(stats: typeof homeStats, team: string, weight: number, scored: number, conceded: number) {
    const total = stats.get(team) ?? { weight: 0, scored: 0, conceded: 0 }
    total.weight += weight
    total.scored += weight * scored
    total.conceded += weight * conceded
    stats.set(team, total)
  }
  let weightTotal = 0
  let homeWeightedGoals = 0
  let awayWeightedGoals = 0
  for (const [day, home, away, homeGoals, awayGoals] of results.values()) {
    const weight = 2 ** (-(cutoff - day) / FORM_HALF_LIFE_DAYS)
    weightTotal += weight
    homeWeightedGoals += weight * homeGoals
    awayWeightedGoals += weight * awayGoals
    record(homeStats, home, weight, homeGoals, awayGoals)
    record(awayStats, away, weight, awayGoals, homeGoals)
  }
  if (!weightTotal) return null
  const leagueAvgHome = homeWeightedGoals / weightTotal
  const leagueAvgAway = awayWeightedGoals / weightTotal
  function strength(stats: typeof homeStats, key: string, metric: 'scored' | 'conceded', leagueAverage: number) {
    const total = stats.get(key)
    return leagueAverage > 0
      ? ((total?.[metric] ?? 0) + leagueAverage * PRIOR_MATCHES) / ((total?.weight ?? 0) + PRIOR_MATCHES) / leagueAverage
      : 1
  }
  function expectedGoals(home: string, away: string) {
    const homeKey = teamKey(home)
    const awayKey = teamKey(away)
    return {
      home: leagueAvgHome * strength(homeStats, homeKey, 'scored', leagueAvgHome) *
        strength(awayStats, awayKey, 'conceded', leagueAvgHome),
      away: leagueAvgAway * strength(awayStats, awayKey, 'scored', leagueAvgAway) *
        strength(homeStats, homeKey, 'conceded', leagueAvgAway),
    }
  }
  return { expectedGoals, leagueAvgHome, leagueAvgAway, historyMatches: results.size }
}
