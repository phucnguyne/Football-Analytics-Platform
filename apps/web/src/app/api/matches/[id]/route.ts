import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { toMatchDetailResponse } from '@/lib/db-helpers'
import { env } from '@/lib/env'

const API_URL = env.FOOTBALL_DATA_API_URL
const API_KEY = env.FOOTBALL_DATA_API_KEY
const DETAILS_FETCHED_AT = '__matchDetailsFetchedAt'

/** Fetch and cache the provider's unmodified match details in the match record. */
async function fetchAndCacheMatchDetails(matchId: number) {
  const res = await fetch(`${API_URL}/matches/${matchId}`, {
    headers: { 'X-Auth-Token': API_KEY },
  })
  if (!res.ok) {
    console.warn('Football provider match detail request failed:', {
      matchId,
      status: res.status,
    })
    return null
  }

  const data: unknown = await res.json()
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Football data provider returned an invalid match detail response')
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      rawData: {
        ...data,
        [DETAILS_FETCHED_AT]: new Date().toISOString(),
      },
    },
  })

  return data
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const matchId = Number(id)

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: 'invalid match id' }, { status: 400 })
  }

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        score: true,
        league: true,
        events: {
          include: { player: true, relatedPlayer: true },
          orderBy: { minute: 'asc' },
        },
        lineups: {
          include: { player: true, team: true },
        },
        statistics: true,
      },
    })

    if (!match) {
      const res = await fetch(`${API_URL}/matches/${matchId}`, {
        headers: { 'X-Auth-Token': API_KEY },
      })
      if (!res.ok) return NextResponse.json({ error: 'not found' }, { status: res.status })
      return NextResponse.json(await res.json())
    }

    const rawData =
      match.rawData && typeof match.rawData === 'object' && !Array.isArray(match.rawData)
        ? match.rawData
        : null
    const detailsAlreadyFetched = Boolean(rawData?.[DETAILS_FETCHED_AT])

    if (detailsAlreadyFetched && rawData) {
      const { [DETAILS_FETCHED_AT]: _fetchedAt, ...providerData } = rawData
      return NextResponse.json(providerData)
    }

    if (match.status === 'FINISHED' && !detailsAlreadyFetched) {
      const providerData = await fetchAndCacheMatchDetails(matchId)
      if (providerData) return NextResponse.json(providerData)
    }

    return NextResponse.json(toMatchDetailResponse(match))
  } catch (error) {
    console.error('Error fetching match detail:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
