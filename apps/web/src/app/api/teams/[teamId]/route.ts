import { NextRequest, NextResponse } from 'next/server'

function lastCompletedSeason(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return month >= 8 ? year : year - 1
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params

  const res = await fetch(
    `${process.env.FOOTBALL_DATA_API_URL}/teams/${teamId}`,
    { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
  )
  if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: res.status })

  const data = await res.json()

  // Off-season: squad is empty because clubs haven't registered for the new season yet.
  // Re-fetch with the last completed season so players are always visible.
  if (!data.squad?.length) {
    const season = lastCompletedSeason()
    const fallback = await fetch(
      `${process.env.FOOTBALL_DATA_API_URL}/teams/${teamId}?season=${season}`,
      { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
    )
    if (fallback.ok) {
      const fallbackData = await fallback.json()
      if (fallbackData.squad?.length) {
        return NextResponse.json(fallbackData)
      }
    }
  }

  return NextResponse.json(data)
}