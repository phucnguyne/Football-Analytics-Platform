import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const query = searchParams.get('query') || ''
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '25'))

  try {
    const players = await prisma.player.findMany({
      where: query
        ? {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          }
        : undefined,
      include: {
        teams: {
          include: {
            team: true,
          },
        },
        stats: true,
      },
      take: limit,
      orderBy: {
        name: 'asc',
      },
    })

    const formatted = players.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      shirtNumber: p.shirtNumber,
      team: p.teams[0]?.team
        ? {
            id: p.teams[0].team.id,
            name: p.teams[0].team.name,
            shortName: p.teams[0].team.shortName,
            crest: p.teams[0].team.crest,
          }
        : null,
    }))

    return NextResponse.json({ players: formatted }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('Error querying players:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

