import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  
  const searchParams = req.nextUrl.searchParams
  let query = '?'
  searchParams.forEach((value, key) => {
    query += `${key}=${value}&`
  })
  
  // if no status/limit provided, fetch full season
  const res = await fetch(
    `${process.env.FOOTBALL_DATA_API_URL}/teams/${teamId}/matches${query}`,
    { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
  )
  if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: res.status })
  return NextResponse.json(await res.json())
}
