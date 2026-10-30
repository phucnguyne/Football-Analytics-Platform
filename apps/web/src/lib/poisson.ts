/**
 * Shared Poisson match-outcome probability utilities.
 * Used by both /api/predictions/season and /api/matches/[id].
 */

/** Poisson probability: P(X=k) given mean lambda */
export function poisson(k: number, lambda: number): number {
  // Use log-space to avoid factorial overflow for large k
  let logP = -lambda + k * Math.log(lambda)
  for (let i = 2; i <= k; i++) logP -= Math.log(i)
  return Math.exp(logP)
}

/** Compute win/draw/loss probabilities using Poisson model.
 *  Returns { homeWin, draw, awayWin } rounded to 1 decimal (%).
 */
export function computeMatchProbabilities(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals = 8
): { homeWin: number; draw: number; awayWin: number } {
  let homeWin = 0
  let draw = 0
  let awayWin = 0

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poisson(h, lambdaHome) * poisson(a, lambdaAway)
      if (h > a) homeWin += p
      else if (h === a) draw += p
      else awayWin += p
    }
  }

  const total = homeWin + draw + awayWin || 1
  return {
    homeWin: Math.round((homeWin / total) * 1000) / 10,
    draw: Math.round((draw / total) * 1000) / 10,
    awayWin: Math.round((awayWin / total) * 1000) / 10,
  }
}

export interface TeamStrength {
  has: number // home attack strength
  aas: number // away attack strength
  hds: number // home defense strength (goals conceded at home vs league avg)
  ads: number // away defense strength
}

/** Compute per-team attack/defence strengths from a set of finished matches.
 *  Returns { strengths, leagueAvgHome, leagueAvgAway } or null if no data.
 */
export function computeTeamStrengths(
  finishedMatches: {
    homeTeamId: number
    awayTeamId: number
    score: { homeTeamGoals: number; awayTeamGoals: number } | null
  }[]
): {
  strengths: Record<number, TeamStrength>
  leagueAvgHome: number
  leagueAvgAway: number
} | null {
  if (finishedMatches.length === 0) return null

  let totalHome = 0
  let totalAway = 0
  const stats: Record<
    number,
    {
      homeGS: number; homeGC: number; homeM: number
      awayGS: number; awayGC: number; awayM: number
    }
  > = {}

  const ensure = (id: number) => {
    if (!stats[id]) stats[id] = { homeGS: 0, homeGC: 0, homeM: 0, awayGS: 0, awayGC: 0, awayM: 0 }
  }

  for (const m of finishedMatches) {
    const hg = m.score?.homeTeamGoals ?? 0
    const ag = m.score?.awayTeamGoals ?? 0
    totalHome += hg
    totalAway += ag
    ensure(m.homeTeamId)
    ensure(m.awayTeamId)
    stats[m.homeTeamId].homeGS += hg
    stats[m.homeTeamId].homeGC += ag
    stats[m.homeTeamId].homeM++
    stats[m.awayTeamId].awayGS += ag
    stats[m.awayTeamId].awayGC += hg
    stats[m.awayTeamId].awayM++
  }

  const n = finishedMatches.length
  const leagueAvgHome = totalHome / n
  const leagueAvgAway = totalAway / n

  const strengths: Record<number, TeamStrength> = {}
  for (const [idStr, s] of Object.entries(stats)) {
    const id = Number(idStr)
    strengths[id] = {
      has: s.homeM > 0 ? (s.homeGS / s.homeM) / leagueAvgHome : 1,
      aas: s.awayM > 0 ? (s.awayGS / s.awayM) / leagueAvgAway : 1,
      hds: s.homeM > 0 ? (s.homeGC / s.homeM) / leagueAvgAway : 1,
      ads: s.awayM > 0 ? (s.awayGC / s.awayM) / leagueAvgHome : 1,
    }
  }

  return { strengths, leagueAvgHome, leagueAvgAway }
}

