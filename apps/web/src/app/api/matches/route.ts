import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') ?? 'LIVE,IN_PLAY,PAUSED'

  const res = await fetch(
    `${process.env.FOOTBALL_DATA_API_URL}/matches?status=${status}`,
    { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
  )
  if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: res.status })
  return NextResponse.json(await res.json())
}
