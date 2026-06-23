import { NextRequest, NextResponse } from 'next/server'

/** Returns the starting year of the last completed season.
 *  PL seasons run Aug–May, so if we're before August the last season
 *  started the previous calendar year (e.g. June 2026 → season 2025). */
function lastCompletedSeason(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-based
  return month >= 8 ? year : year - 1
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ competition: string }> }
) {
  const { competition } = await params
  const status = req.nextUrl.searchParams.get('status') ?? 'FINISHED'
  // Allow callers to override season; default to last completed season so we
  // never return an empty array during the summer off-season.
  const season =
    req.nextUrl.searchParams.get('season') ?? String(lastCompletedSeason())

  const res = await fetch(
    `${process.env.FOOTBALL_DATA_API_URL}/competitions/${competition}/matches?status=${status}&season=${season}`,
    { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'upstream error' }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}