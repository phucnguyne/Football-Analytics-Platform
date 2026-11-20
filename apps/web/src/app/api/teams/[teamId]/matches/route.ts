import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { MatchStatus, type Prisma } from '@app/database'
import { toMatchResponse } from '@/lib/db-helpers'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const id = parseInt(teamId)

  if (isNaN(id)) {
    return NextResponse.json({ error: 'invalid team id' }, { status: 400 })
  }

  try {
    const statusParam = req.nextUrl.searchParams.get('status')
    const limitParam = req.nextUrl.searchParams.get('limit')

    const where: Prisma.MatchWhereInput = {
      OR: [{ homeTeamId: id }, { awayTeamId: id }],
    }

    if (statusParam) {
      const statuses = statusParam.split(',').map((status) => status.trim())
        .filter((status): status is MatchStatus => Object.values(MatchStatus).includes(status as MatchStatus))
      if (statuses.length === 0) {
        return NextResponse.json({ error: 'invalid match status' }, { status: 400 })
      }
      where.status = { in: statuses }
    }

    const matches = await prisma.match.findMany({
      where,
      include: {
        homeTeam: true,
        awayTeam: true,
        score: true,
        league: true,
      },
      orderBy: { utcDate: 'desc' },
      take: limitParam ? parseInt(limitParam) : undefined,
    })

    return NextResponse.json({
      matches: matches.map(toMatchResponse),
    })
  } catch (error) {
    console.error('Error fetching team matches:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
