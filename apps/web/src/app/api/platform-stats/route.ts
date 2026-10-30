import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'

export const revalidate = 300 // ISR: revalidate every 5 min

export async function GET() {
  try {
    const [matchCount, playerCount, finishedCount, leagueCount] = await Promise.all([
      prisma.match.count(),
      prisma.player.count(),
      prisma.match.count({ where: { status: 'FINISHED' } }),
      prisma.league.count(),
    ])

    return NextResponse.json(
      { matchCount, playerCount, finishedCount, leagueCount },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch {
    // Return zeroes gracefully so the home page still renders
    return NextResponse.json(
      { matchCount: 0, playerCount: 0, finishedCount: 0, leagueCount: 0 },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

