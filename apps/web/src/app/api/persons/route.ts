import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { env } from '@/lib/env'
import {
  apiFootballPlayerNameMatches,
  getApiFootballTeamSquad,
} from '@/lib/api-football'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const query = searchParams.get('query')?.trim() || ''
  const parsedLimit = Number.parseInt(searchParams.get('limit') || '25', 10)
  const limit = Number.isInteger(parsedLimit) ? Math.min(50, Math.max(1, parsedLimit)) : 25
  const teamIdParam = searchParams.get('teamId')
  const teamId = teamIdParam ? Number.parseInt(teamIdParam, 10) : undefined

  if (teamIdParam && (teamId === undefined || !Number.isInteger(teamId) || teamId <= 0)) {
    return NextResponse.json({ error: 'invalid team id' }, { status: 400 })
  }

  try {
    if (teamId) {
      const localTeam = await prisma.team.findUnique({ where: { id: teamId } })
      let providerData: any = null
      let providerStatus: number | null = null
      if (!localTeam) {
        const response = await fetch(
          `${env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
          {
            headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
            next: { revalidate: 3600 },
          },
        )
        if (response.ok) {
          providerData = await response.json()
        } else {
          providerStatus = response.status
        }
      }

      const teamName = localTeam?.name ?? providerData?.name
      const apiSquad = teamName ? await getApiFootballTeamSquad(teamName) : null

      if (apiSquad) {
        const localRoster = localTeam
          ? await prisma.player.findMany({
              where: { teams: { some: { teamId } } },
              include: {
                teams: {
                  where: { teamId },
                  include: { team: true },
                },
              },
            })
          : []
        const providerRoster = providerData?.squad ?? providerData?.players ?? []
        const candidateRoster = localRoster.length > 0 ? localRoster : providerRoster
        const players = apiSquad.flatMap((apiPlayer) => {
          const matches = candidateRoster.filter((player: { name?: string }) =>
            player.name && apiFootballPlayerNameMatches(apiPlayer.name, player.name),
          )
          if (matches.length !== 1) return []

          const player = matches[0]
          return [{
            id: player.id,
            name: player.name,
            position: apiPlayer.position || player.position,
            shirtNumber: apiPlayer.number ?? player.shirtNumber,
            photo: apiPlayer.photo ?? player.photo,
            team: localTeam
              ? {
                  id: localTeam.id,
                  name: localTeam.name,
                  shortName: localTeam.shortName,
                  crest: localTeam.crest,
                }
              : providerData
                ? {
                    id: providerData.id,
                    name: providerData.name,
                    shortName: providerData.shortName,
                    crest: providerData.crest,
                  }
                : null,
          }]
        })
          .filter((player) => player.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
          .slice(0, limit)

        if (players.length === 0) {
          return NextResponse.json(
            { error: 'Could not match this team squad to local player records' },
            { status: 503 },
          )
        }

        return NextResponse.json(
          { players },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
          },
        )
      }

      if (!providerData) {
        const response = await fetch(
          `${env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
          {
            headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
            next: { revalidate: 3600 },
          },
        )
        if (response.ok) {
          providerData = await response.json()
        }
      }

      if (providerData) {
        const roster = providerData.squad ?? providerData.players ?? []
        if (roster.length > 0) {
          const normalizedQuery = query.toLocaleLowerCase()
          const players = roster
            .filter((player: { name?: string }) =>
              (player.name ?? '').toLocaleLowerCase().includes(normalizedQuery),
            )
            .slice(0, limit)
            .map((player: {
              id: number
              name: string
              position?: string
              shirtNumber?: number | null
              photo?: string | null
            }) => ({
              id: player.id,
              name: player.name,
              position: player.position ?? '',
              shirtNumber: player.shirtNumber ?? null,
              photo: player.photo ?? null,
              team: {
                id: providerData.id,
                name: providerData.name,
                shortName: providerData.shortName,
                crest: providerData.crest,
              },
            }))

          return NextResponse.json(
            { players },
            {
              headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
              },
            },
          )
        }
      }

      const roster = await prisma.player.findMany({
        where: { teams: { some: { teamId } } },
        include: {
          teams: {
            where: { teamId },
            include: { team: true },
          },
        },
        orderBy: { name: 'asc' },
      })

      if (roster.length > 0) {
        const normalizedQuery = query.toLocaleLowerCase()
        const players = roster
          .filter((player) => player.name.toLocaleLowerCase().includes(normalizedQuery))
          .slice(0, limit)

        return NextResponse.json(
          {
            players: players.map((player) => ({
              id: player.id,
              name: player.name,
              position: player.position,
              shirtNumber: player.shirtNumber,
              photo: player.photo,
              team: player.teams[0]?.team
                ? {
                    id: player.teams[0].team.id,
                    name: player.teams[0].team.name,
                    shortName: player.teams[0].team.shortName,
                    crest: player.teams[0].team.crest,
                  }
                : null,
            })),
          },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            },
          },
        )
      }

      if (providerStatus !== null) {
        return NextResponse.json(
          { error: 'Could not load this team roster from the football data provider' },
          { status: providerStatus },
        )
      }

      return NextResponse.json({ players: [] })
    }

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
      photo: p.photo,
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
