import { measureProviderCalls } from '@/lib/provider-timing'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { searchPlayers } from '@/services/player.service'
import {
  escapeSearchTerm,
  MAX_SEARCH_LENGTH,
  MIN_SEARCH_LENGTH,
  splitFixtureQuery,
  type SearchResults,
} from '@/lib/search'

const resultLimit = 5

function teamName(query: string) {
  const contains = { contains: escapeSearchTerm(query), mode: 'insensitive' as const }
  return { OR: [{ name: contains }, { shortName: contains }] }
}

export function GET(request: NextRequest) {
  return measureProviderCalls(() => load(request))
}

async function load(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')?.trim() ?? ''
  if (query.length < MIN_SEARCH_LENGTH || query.length > MAX_SEARCH_LENGTH) {
    return NextResponse.json({ error: 'invalid search length' }, { status: 400 })
  }

  const fixture = splitFixtureQuery(query)
  const team = teamName(query)
  const matchFilter = fixture
    ? {
        OR: [
          { homeTeam: teamName(fixture[0]), awayTeam: teamName(fixture[1]) },
          { homeTeam: teamName(fixture[1]), awayTeam: teamName(fixture[0]) },
        ],
      }
    : { OR: [{ homeTeam: team }, { awayTeam: team }] }

  try {
    const [playerResult, teams, matches] = await Promise.all([
      searchPlayers({ query, limit: resultLimit }),
      prisma.team.findMany({
        where: team,
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: resultLimit,
      }),
      prisma.match.findMany({
        where: matchFilter,
        select: {
          id: true,
          utcDate: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
          league: { select: { name: true } },
        },
        orderBy: [{ utcDate: 'desc' }, { id: 'desc' }],
        take: resultLimit,
      }),
    ])

    const results: SearchResults = {
      players: (playerResult.data.players ?? []).map(({ id, name, team }) => ({
        id,
        name,
        team: team ? { name: team.name } : null,
      })),
      teams,
      matches: matches.map(({ id, homeTeam, awayTeam, league, utcDate }) => ({
        id,
        home: homeTeam.name,
        away: awayTeam.name,
        league: league.name,
        utcDate: utcDate.toISOString(),
      })),
    }

    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('Search failed:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
