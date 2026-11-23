import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import prisma from '@app/database/src/client'

const privateHeaders = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: user ? 'Forbidden' : 'Unauthorized' }, {
      status: user ? 403 : 401,
      headers: privateHeaders,
    })
  }

  try {
    const [matchCount, playerCount, finishedCount, leagueCount] = await Promise.all([
      prisma.match.count(),
      prisma.player.count(),
      prisma.match.count({ where: { status: 'FINISHED' } }),
      prisma.league.count(),
    ])

    return NextResponse.json(
      { matchCount, playerCount, finishedCount, leagueCount },
      { headers: privateHeaders }
    )
  } catch {
    // Return zeroes gracefully so the home page still renders
    return NextResponse.json(
      { matchCount: 0, playerCount: 0, finishedCount: 0, leagueCount: 0 },
      { headers: privateHeaders }
    )
  }
}

