import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'

// Simple seeded random function
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const matchId = parseInt(id)
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { score: true }
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Generate deterministic stats based on match ID, minute, and score
    const currentMinute = match.minute || 0
    const homeGoals = match.score?.homeTeamGoals || 0
    const awayGoals = match.score?.awayTeamGoals || 0
    const isFinished = match.status === 'FINISHED'

    // If it hasn't started, return empty stats
    if (match.status === 'SCHEDULED' || match.status === 'TIMED') {
      return NextResponse.json({
        possession: { home: 50, away: 50 },
        shots: { home: 0, away: 0 },
        shotsOnTarget: { home: 0, away: 0 },
        corners: { home: 0, away: 0 },
        fouls: { home: 0, away: 0 },
        momentum: []
      })
    }

    const seedBase = matchId + (isFinished ? 90 : currentMinute)
    
    // Simulate possession: home team base 50% + random variance (-15% to +15%)
    let homePossession = 50 + Math.floor(seededRandom(seedBase) * 30) - 15
    if (homeGoals > awayGoals) homePossession -= 5
    if (awayGoals > homeGoals) homePossession += 5
    // ensure bounds
    homePossession = Math.max(20, Math.min(80, homePossession))
    const awayPossession = 100 - homePossession

    // Shots
    const totalShots = Math.floor(currentMinute / 5) + Math.floor(seededRandom(seedBase + 1) * 5)
    const homeShots = Math.max(homeGoals, Math.floor(totalShots * (homePossession / 100)) + homeGoals)
    const awayShots = Math.max(awayGoals, totalShots - homeShots + awayGoals)

    const homeShotsOnTarget = Math.max(homeGoals, Math.floor(homeShots * (0.3 + seededRandom(seedBase + 2) * 0.3)))
    const awayShotsOnTarget = Math.max(awayGoals, Math.floor(awayShots * (0.3 + seededRandom(seedBase + 3) * 0.3)))

    // Momentum array (for the graph)
    const momentum = []
    const pointsCount = Math.floor((isFinished ? 90 : currentMinute) / 5)
    for (let i = 0; i <= pointsCount; i++) {
       const mSeed = matchId + i
       // Value between -100 (Away dominance) and 100 (Home dominance)
       let val = Math.floor((seededRandom(mSeed) * 200) - 100)
       
       if (i > 0) {
         val = (val + momentum[i-1].value) / 2
       }
       
       momentum.push({
         minute: i * 5,
         value: Math.round(val)
       })
    }

    const stats = {
      possession: { home: homePossession, away: awayPossession },
      shots: { home: homeShots, away: awayShots },
      shotsOnTarget: { home: homeShotsOnTarget, away: awayShotsOnTarget },
      corners: { 
        home: Math.floor(homeShots / 2.5), 
        away: Math.floor(awayShots / 2.5) 
      },
      fouls: {
        home: Math.floor(currentMinute / 8) + Math.floor(seededRandom(seedBase + 4) * 3),
        away: Math.floor(currentMinute / 8) + Math.floor(seededRandom(seedBase + 5) * 3)
      },
      momentum
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching simulated stats:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

