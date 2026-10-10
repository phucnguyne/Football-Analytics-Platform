import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'

// Factorial
function factorial(n: number): number {
  if (n <= 1) return 1
  let f = 1
  for (let i = 2; i <= n; i++) f *= i
  return f
}

// Poisson
function poisson(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
}

export async function GET() {
  try {
    // Get finished matches to compute strengths
    const finishedMatches = await prisma.match.findMany({
      where: { status: 'FINISHED' },
      include: { score: true, homeTeam: true, awayTeam: true },
    })

    if (finishedMatches.length === 0) {
      return NextResponse.json({ error: 'No finished matches for modeling' }, { status: 400 })
    }

    let totalHomeGoals = 0
    let totalAwayGoals = 0
    const teamStats: Record<number, {
      name: string, shortName: string, crest: string | null,
      homeMatches: number, homeGoalsScored: number, homeGoalsConceded: number,
      awayMatches: number, awayGoalsScored: number, awayGoalsConceded: number,
      currentPoints: number, currentGF: number, currentGA: number, currentGD: number,
      currentWins: number, currentDraws: number, currentLosses: number, currentPlayed: number,
    }> = {}

    for (const m of finishedMatches) {
      const hg = m.score?.homeTeamGoals ?? 0
      const ag = m.score?.awayTeamGoals ?? 0
      totalHomeGoals += hg
      totalAwayGoals += ag

      if (!teamStats[m.homeTeamId]) {
        teamStats[m.homeTeamId] = {
          name: m.homeTeam.name, shortName: m.homeTeam.shortName, crest: m.homeTeam.crest,
          homeMatches: 0, homeGoalsScored: 0, homeGoalsConceded: 0,
          awayMatches: 0, awayGoalsScored: 0, awayGoalsConceded: 0,
          currentPoints: 0, currentGF: 0, currentGA: 0, currentGD: 0,
          currentWins: 0, currentDraws: 0, currentLosses: 0, currentPlayed: 0,
        }
      }
      if (!teamStats[m.awayTeamId]) {
        teamStats[m.awayTeamId] = {
          name: m.awayTeam.name, shortName: m.awayTeam.shortName, crest: m.awayTeam.crest,
          homeMatches: 0, homeGoalsScored: 0, homeGoalsConceded: 0,
          awayMatches: 0, awayGoalsScored: 0, awayGoalsConceded: 0,
          currentPoints: 0, currentGF: 0, currentGA: 0, currentGD: 0,
          currentWins: 0, currentDraws: 0, currentLosses: 0, currentPlayed: 0,
        }
      }

      teamStats[m.homeTeamId].homeMatches++
      teamStats[m.homeTeamId].homeGoalsScored += hg
      teamStats[m.homeTeamId].homeGoalsConceded += ag
      teamStats[m.homeTeamId].currentGF += hg
      teamStats[m.homeTeamId].currentGA += ag
      teamStats[m.homeTeamId].currentPlayed++

      teamStats[m.awayTeamId].awayMatches++
      teamStats[m.awayTeamId].awayGoalsScored += ag
      teamStats[m.awayTeamId].awayGoalsConceded += hg
      teamStats[m.awayTeamId].currentGF += ag
      teamStats[m.awayTeamId].currentGA += hg
      teamStats[m.awayTeamId].currentPlayed++

      if (hg > ag) {
        teamStats[m.homeTeamId].currentPoints += 3
        teamStats[m.homeTeamId].currentWins++
        teamStats[m.awayTeamId].currentLosses++
      } else if (hg === ag) {
        teamStats[m.homeTeamId].currentPoints += 1
        teamStats[m.awayTeamId].currentPoints += 1
        teamStats[m.homeTeamId].currentDraws++
        teamStats[m.awayTeamId].currentDraws++
      } else {
        teamStats[m.awayTeamId].currentPoints += 3
        teamStats[m.awayTeamId].currentWins++
        teamStats[m.homeTeamId].currentLosses++
      }
    }

    for (const id of Object.keys(teamStats)) {
      teamStats[parseInt(id)].currentGD = teamStats[parseInt(id)].currentGF - teamStats[parseInt(id)].currentGA
    }

    const totalMatches = finishedMatches.length
    const leagueAvgHome = totalHomeGoals / totalMatches
    const leagueAvgAway = totalAwayGoals / totalMatches

    // Compute attack/defense strengths per team
    const strengths: Record<number, { has: number, aas: number, hds: number, ads: number }> = {}
    for (const [idStr, s] of Object.entries(teamStats)) {
      const id = parseInt(idStr)
      strengths[id] = {
        has: s.homeMatches > 0 ? (s.homeGoalsScored / s.homeMatches) / leagueAvgHome : 1,
        aas: s.awayMatches > 0 ? (s.awayGoalsScored / s.awayMatches) / leagueAvgAway : 1,
        hds: s.homeMatches > 0 ? (s.homeGoalsConceded / s.homeMatches) / leagueAvgAway : 1,
        ads: s.awayMatches > 0 ? (s.awayGoalsConceded / s.awayMatches) / leagueAvgHome : 1,
      }
    }

    // Get remaining scheduled matches
    const remaining = await prisma.match.findMany({
      where: { status: { in: ['SCHEDULED', 'TIMED'] } },
    })

    // Monte Carlo: simulate N seasons
    const N = 10000
    const teamIds = Object.keys(teamStats).map(Number)
    const titleCount: Record<number, number> = {}
    const topFourCount: Record<number, number> = {}
    const relegationCount: Record<number, number> = {}
    const pointsTotals: Record<number, number[]> = {}

    for (const id of teamIds) {
      titleCount[id] = 0
      topFourCount[id] = 0
      relegationCount[id] = 0
      pointsTotals[id] = []
    }

    for (let sim = 0; sim < N; sim++) {
      // Start with current points
      const simPoints: Record<number, number> = {}
      const simGD: Record<number, number> = {}
      for (const id of teamIds) {
        simPoints[id] = teamStats[id].currentPoints
        simGD[id] = teamStats[id].currentGD
      }

      // Simulate each remaining match
      for (const m of remaining) {
        const homeS = strengths[m.homeTeamId] || { has: 1, hds: 1 }
        const awayS = strengths[m.awayTeamId] || { aas: 1, ads: 1 }
        const lambdaH = homeS.has * awayS.ads * leagueAvgHome
        const lambdaA = awayS.aas * homeS.hds * leagueAvgAway

        // Random Poisson sample for goals
        const hGoals = poissonSample(lambdaH)
        const aGoals = poissonSample(lambdaA)

        if (simPoints[m.homeTeamId] !== undefined) {
          simGD[m.homeTeamId] += (hGoals - aGoals)
        }
        if (simPoints[m.awayTeamId] !== undefined) {
          simGD[m.awayTeamId] += (aGoals - hGoals)
        }

        if (hGoals > aGoals) {
          if (simPoints[m.homeTeamId] !== undefined) simPoints[m.homeTeamId] += 3
        } else if (hGoals === aGoals) {
          if (simPoints[m.homeTeamId] !== undefined) simPoints[m.homeTeamId] += 1
          if (simPoints[m.awayTeamId] !== undefined) simPoints[m.awayTeamId] += 1
        } else {
          if (simPoints[m.awayTeamId] !== undefined) simPoints[m.awayTeamId] += 3
        }
      }

      // Rank teams by points, then GD
      const ranking = teamIds.slice().sort((a, b) => {
        if (simPoints[b] !== simPoints[a]) return simPoints[b] - simPoints[a]
        return simGD[b] - simGD[a]
      })

      titleCount[ranking[0]]++
      for (let i = 0; i < 4 && i < ranking.length; i++) topFourCount[ranking[i]]++
      for (let i = Math.max(0, ranking.length - 3); i < ranking.length; i++) relegationCount[ranking[i]]++

      for (const id of teamIds) {
        pointsTotals[id].push(simPoints[id])
      }
    }

    // Compute final results
    const results = teamIds.map(id => {
      const pts = pointsTotals[id]
      const avgPoints = pts.reduce((a, b) => a + b, 0) / N
      const minPoints = Math.min(...pts)
      const maxPoints = Math.max(...pts)

      // Compute median
      const sorted = [...pts].sort((a, b) => a - b)
      const medianPoints = sorted[Math.floor(N / 2)]

      return {
        teamId: id,
        name: teamStats[id].name,
        shortName: teamStats[id].shortName,
        crest: teamStats[id].crest,
        currentPoints: teamStats[id].currentPoints,
        currentPlayed: teamStats[id].currentPlayed,
        currentGD: teamStats[id].currentGD,
        avgPoints: Math.round(avgPoints * 10) / 10,
        medianPoints,
        minPoints,
        maxPoints,
        titleProb: Math.round((titleCount[id] / N) * 1000) / 10,
        topFourProb: Math.round((topFourCount[id] / N) * 1000) / 10,
        relegationProb: Math.round((relegationCount[id] / N) * 1000) / 10,
      }
    }).sort((a, b) => b.avgPoints - a.avgPoints)

    return NextResponse.json({
      simulations: N,
      matchesPlayed: finishedMatches.length,
      matchesRemaining: remaining.length,
      leagueAvgHomeGoals: Math.round(leagueAvgHome * 100) / 100,
      leagueAvgAwayGoals: Math.round(leagueAvgAway * 100) / 100,
      teams: results,
    })
  } catch (error) {
    console.error('Prediction error:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

// Random Poisson sample using inverse transform
function poissonSample(lambda: number): number {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= Math.random()
  } while (p > L)
  return k - 1
}

