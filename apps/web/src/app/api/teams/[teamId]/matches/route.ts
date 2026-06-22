import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const status = req.nextUrl.searchParams.get('status') ?? 'FINISHED'
  const limit  = req.nextUrl.searchParams.get('limit')  ?? '5'

  const res = await fetch(
    `${process.env.FOOTBALL_DATA_API_URL}/teams/${teamId}/matches?status=${status}&limit=${limit}`,
    { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
  )
  if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: res.status })
  return NextResponse.json(await res.json())
}
