import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toTeamResponse } from '@/lib/db-helpers'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const id = parseInt(teamId)

  if (isNaN(id)) {
    return NextResponse.json({ error: 'invalid team id' }, { status: 400 })
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        players: {
          include: { player: true },
        },
      },
    })

    if (!team) {
      // Team not in DB, fallback to external API
      const res = await fetch(
        `${process.env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
      )
      if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: res.status })
      return NextResponse.json(await res.json())
    }

    // If no players in PlayerTeam, fallback to external API for squad
    if (team.players.length === 0) {
      const res = await fetch(
        `${process.env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
      )
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({
          ...toTeamResponse(team),
          coach: data.coach,
          squad: data.squad ?? data.players ?? [],
        })
      }
    }

    // Try to get coach even if we have players (using a quick fetch to football-data)
    let coachData;
    try {
      const res = await fetch(
        `${process.env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
      )
      if (res.ok) {
        const data = await res.json()
        coachData = data.coach;
      }
    } catch (e) {}

    return NextResponse.json({
      ...toTeamResponse(team),
      coach: coachData,
      squad: team.players.map(pt => ({
        id: pt.player.id,
        name: pt.player.name,
        position: pt.player.position,
        dateOfBirth: pt.player.dateOfBirth?.toISOString()?.split('T')[0] ?? null,
        nationality: pt.player.nationality,
        shirtNumber: pt.shirtNumber ?? pt.player.shirtNumber,
      })),
    })
  } catch (error) {
    console.error('Error fetching team:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}