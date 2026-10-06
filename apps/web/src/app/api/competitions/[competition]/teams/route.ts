import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toTeamResponse } from '@/lib/db-helpers'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ competition: string }> }
) {
  const { competition } = await params

  try {
    const season = await prisma.season.findFirst({
      where: { isCurrent: true },
    })

    if (!season) {
      // Fallback to external API
      const res = await fetch(
        `${process.env.FOOTBALL_DATA_API_URL}/competitions/${competition}/teams`,
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
      )
      if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: res.status })
      return NextResponse.json(await res.json())
    }

    const teamSeasons = await prisma.teamSeason.findMany({
      where: { seasonId: season.id },
      include: { team: true },
    })

    return NextResponse.json({
      teams: teamSeasons.map(ts => toTeamResponse(ts.team)),
    })
  } catch (error) {
    console.error('Error fetching teams:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
