import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import type { Position } from '@app/database'
import { toTeamResponse } from '@/lib/db-helpers'
import { env } from '@/lib/env'
import { isPlaceholderPlayerName } from '@/lib/data-source'
import {
  apiFootballPlayerNameMatches,
  getApiFootballTeamSquad,
} from '@/lib/api-football'
import type { FootballDataPerson, FootballDataTeamDetail } from '@/types/TypesBarrel'

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
        {
          redirect: "error",          headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
          next: { revalidate: 3600 },
        }
      )
      if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: res.status })
      return NextResponse.json(await res.json())
    }

    const knownPlayers = team.players.filter(({ player }) => !isPlaceholderPlayerName(player.name))
    const dbPlayers = knownPlayers.map(({ player }) => player)
    const needsLiveSquad = !knownPlayers.length || knownPlayers.length !== team.players.length

    // Always fetch from football-data.org for coach + fresh squad
    let externalData: FootballDataTeamDetail | null = null
    try {
      const res = await fetch(
        `${env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
        {
          redirect: "error",          headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
          next: { revalidate: 3600 },
        }
      )
      if (res.ok) externalData = await res.json() as FootballDataTeamDetail
    } catch {
      console.warn(`[TeamRoute] Could not reach football-data for team ${teamId}`)
    }

    const externalSquad: FootballDataPerson[] = externalData?.squad ?? externalData?.players ?? []
    const playerPhotos = new Map(dbPlayers.map((player) => [player.id, player.photo]))
    const apiSquad = await getApiFootballTeamSquad(team.name).catch(() => null)
    const externalSquadWithPhotos = externalSquad.map((player) => {
      const apiPlayer = apiSquad?.find((candidate) =>
        apiFootballPlayerNameMatches(candidate.name, player.name),
      )
      return {
        ...player,
        photo: apiPlayer?.photo ?? player.photo ?? playerPhotos.get(player.id) ?? null,
      }
    })

    // If DB has placeholder names, upsert real names from external API in background
    if (needsLiveSquad && externalSquadWithPhotos.length > 0) {
      // Fire-and-forget upsert so future requests use real names
      upsertSquadInBackground(id, externalSquadWithPhotos).catch(err =>
        console.warn('[TeamRoute] Background squad upsert failed:', err)
      )
    }

    const dbSquad = knownPlayers.map(pt => ({
      id: pt.player.id,
      name: pt.player.name,
      position: pt.player.position,
      photo: apiSquad?.find((player) =>
        apiFootballPlayerNameMatches(player.name, pt.player.name),
      )?.photo ?? pt.player.photo,
      dateOfBirth: pt.player.dateOfBirth?.toISOString()?.split('T')[0] ?? null,
      nationality: pt.player.nationality,
      shirtNumber: pt.shirtNumber ?? pt.player.shirtNumber,
    }))

    return NextResponse.json({
      ...toTeamResponse(team),
      coach: externalData?.coach ?? null,
      clubColors: externalData?.clubColors ?? null,
      squad: externalSquadWithPhotos.length > 0 ? externalSquadWithPhotos : dbSquad,
    })
  } catch (error) {
    console.error('Error fetching team:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

/** Upsert real player names from football-data.org squad into the DB */
async function upsertSquadInBackground(teamId: number, squad: FootballDataPerson[]) {
  for (const p of squad) {
    if (!p.id || !p.name) continue
    const positionMap: Record<string, Position> = {
      Goalkeeper: 'GOALKEEPER', Defender: 'DEFENDER',
      Midfielder: 'MIDFIELDER', Forward: 'FORWARD',
      Offence: 'FORWARD',
    }
    const position = positionMap[p.position ?? ''] ?? 'MIDFIELDER'

    try {
      await prisma.player.upsert({
        where: { id: p.id },
        update: {
          name: p.name,
          nationality: p.nationality ?? null,
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
          photo: p.photo ?? undefined,
          shirtNumber: p.shirtNumber ?? null,
        },
        create: {
          id: p.id,
          name: p.name,
          position,
          nationality: p.nationality ?? null,
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
          photo: p.photo ?? null,
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
