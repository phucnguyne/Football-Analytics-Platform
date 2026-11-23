import { NextRequest, NextResponse } from 'next/server'
import { getCompetitionStandings } from '@/services/standings.service'
import { parseSeasonIdentifier } from '@/lib/competition-seasons'

const cacheControl = {
  standard: 'public, s-maxage=300, stale-while-revalidate=600',
  historical: 'public, s-maxage=3600, stale-while-revalidate=86400',
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ competition: string }> }
) {
  const { competition } = await params
  const requestedSeason = parseSeasonIdentifier(
    req.nextUrl.searchParams.get('seasonId'),
  )

  try {
    const result = await getCompetitionStandings(competition, requestedSeason)
    return NextResponse.json(result.data, {
      status: result.status,
      headers: result.cache ? { 'Cache-Control': cacheControl[result.cache] } : undefined,
    })
  } catch (error) {
    console.error('Error fetching standings:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
