import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toTeamResponse } from '@/lib/db-helpers'
import { env } from '@/lib/env'

/**
 * Heuristic: detect placeholder/seeded player names like "Chelsea Goalkeeper 0"
 * or "Brentford Defender 3". Real names don't match this pattern.
 */
function hasPlaceholderNames(players: { name: string }[]): boolean {
  if (players.length === 0) return true
  const genericPattern = /\b(Goalkeeper|Defender|Midfielder|Forward)\s+\d+$/i
  const genericCount = players.filter(p => genericPattern.test(p.name)).length
  return genericCount > players.length * 0.4 // >40% generic = treat as placeholder
}

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
        `${env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
        { headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY } }
      )
      if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: res.status })
      return NextResponse.json(await res.json())
    }

    // If no players in PlayerTeam, fallback to external API for squad
    if (team.players.length === 0) {
    const dbPlayers = team.players.map(pt => pt.player)
    const needsLiveSquad = hasPlaceholderNames(dbPlayers)

    // Always fetch from football-data.org for coach + fresh squad
    let externalData: any = null
    try {
      const res = await fetch(
        `${env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
        { headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY } }
      )
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({
          ...toTeamResponse(team),
          coach: data.coach,
          squad: data.squad ?? data.players ?? [],
        })
      }
      if (res.ok) externalData = await res.json()
    } catch (e) {
      console.warn(`[TeamRoute] Could not reach football-data for team ${teamId}`)
    }

    // Try to get coach even if we have players (using a quick fetch to football-data)
    let coachData;
    try {
      const res = await fetch(
        `${env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
        { headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY } }
    const externalSquad: any[] = externalData?.squad ?? externalData?.players ?? []

    // If DB has placeholder names, upsert real names from external API in background
    if (needsLiveSquad && externalSquad.length > 0) {
      // Fire-and-forget upsert so future requests use real names
      upsertSquadInBackground(id, externalSquad).catch(err =>
        console.warn('[TeamRoute] Background squad upsert failed:', err)
      )
      if (res.ok) {
        const data = await res.json()
        coachData = data.coach;
      }
    } catch (e) {}

      return NextResponse.json({
        ...toTeamResponse(team),
        coach: externalData?.coach ?? null,
        squad: externalSquad,
      })
    }

    // Use DB squad (already has real names)
    return NextResponse.json({
      ...toTeamResponse(team),
      coach: coachData,
      coach: externalData?.coach ?? null,
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

/** Upsert real player names from football-data.org squad into the DB */
async function upsertSquadInBackground(teamId: number, squad: any[]) {
  for (const p of squad) {
    if (!p.id || !p.name) continue
    const positionMap: Record<string, string> = {
      Goalkeeper: 'GOALKEEPER', Defender: 'DEFENDER',
      Midfielder: 'MIDFIELDER', Forward: 'FORWARD',
      Offence: 'FORWARD',
    }
    const position = positionMap[p.position] ?? 'MIDFIELDER'

    try {
      await prisma.player.upsert({
        where: { id: p.id },
        update: {
          name: p.name,
          nationality: p.nationality ?? null,
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
          shirtNumber: p.shirtNumber ?? null,
        },
        create: {
          id: p.id,
          name: p.name,
          position: position as any,
          nationality: p.nationality ?? null,
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
          shirtNumber: p.shirtNumber ?? null,
        },
      })

      const existing = await prisma.playerTeam.findFirst({
        where: { playerId: p.id, teamId },
        select: { id: true },
      })
      if (existing) {
        await prisma.playerTeam.update({
          where: { id: existing.id },
          data: { shirtNumber: p.shirtNumber ?? null },
        })
      } else {
        await prisma.playerTeam.create({
          data: { playerId: p.id, teamId, shirtNumber: p.shirtNumber ?? null },
        })
      }
    } catch (e) {
      // Non-fatal: log and continue to next player
      console.warn(`[TeamRoute] Could not upsert player ${p.id} (${p.name}):`, e)
    }
  }
}