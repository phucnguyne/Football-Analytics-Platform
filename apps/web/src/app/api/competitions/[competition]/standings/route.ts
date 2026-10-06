import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toTeamResponse } from '@/lib/db-helpers'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ competition: string }> }
) {
  const { competition } = await params

  try {
    // Check if we have standings in our DB
    const season = await prisma.season.findFirst({
      where: { isCurrent: true },
    })

    if (season) {
      const standings = await prisma.standing.findMany({
        where: { seasonId: season.id, type: 'TOTAL' },
        include: { team: true },
        orderBy: { position: 'asc' },
      })

      if (standings.length > 0) {
        return NextResponse.json({
          standings: [{
            type: 'TOTAL',
            table: standings.map(s => ({
              position: s.position,
              team: toTeamResponse(s.team),
              playedGames: s.playedGames,
              won: s.wins,
              draw: s.draws,
              lost: s.losses,
              points: s.points,
              goalsFor: s.goalsFor,
              goalsAgainst: s.goalsAgainst,
              goalDifference: s.goalDifference,
            })),
          }],
        })
      }
    }

    // Fallback to external API if no standings in DB
    const res = await fetch(
      `${process.env.FOOTBALL_DATA_API_URL}/competitions/${competition}/standings`,
      { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
    )
    if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: res.status })
    return NextResponse.json(await res.json())
  } catch (error) {
    console.error('Error fetching standings:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
