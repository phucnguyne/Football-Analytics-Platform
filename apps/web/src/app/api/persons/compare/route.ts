import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { generateComparisonVerdict, getPlayerStyleTags } from '@/lib/player-analytics'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const p1Str = searchParams.get('p1')
  const p2Str = searchParams.get('p2')

  const p1Id = p1Str ? parseInt(p1Str) : NaN
  const p2Id = p2Str ? parseInt(p2Str) : NaN

  if (isNaN(p1Id) || isNaN(p2Id)) {
    return NextResponse.json({ error: 'both p1 and p2 are required and must be valid integers' }, { status: 400 })
  }

  try {
    const [p1, p2] = await Promise.all([
      prisma.player.findUnique({
        where: { id: p1Id },
        include: {
          stats: true,
          teams: { include: { team: true } },
        },
      }),
      prisma.player.findUnique({
        where: { id: p2Id },
        include: {
          stats: true,
          teams: { include: { team: true } },
        },
      }),
    ])

    if (!p1 || !p2) {
      return NextResponse.json({ error: 'one or both players not found' }, { status: 404 })
    }

    const formatPlayer = (player: any) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      dateOfBirth: player.dateOfBirth,
      nationality: player.nationality,
      shirtNumber: player.shirtNumber,
      team: player.teams[0]?.team
        ? {
            id: player.teams[0].team.id,
            name: player.teams[0].team.name,
            shortName: player.teams[0].team.shortName,
            crest: player.teams[0].team.crest,
          }
        : null,
      stats: player.stats,
      styleTags: getPlayerStyleTags(player.stats),
    })

    const player1 = formatPlayer(p1)
    const player2 = formatPlayer(p2)
    const verdict = generateComparisonVerdict(player1, player2)

    return NextResponse.json({
      player1,
      player2,
      verdict,
    })
  } catch (error) {
    console.error('Error comparing players:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

