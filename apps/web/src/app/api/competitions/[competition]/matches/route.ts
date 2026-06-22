import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ competition: string }> }
) {
  const { competition } = await params
  const status = req.nextUrl.searchParams.get('status') ?? 'FINISHED'

  const res = await fetch(
    `${process.env.FOOTBALL_DATA_API_URL}/competitions/${competition}/matches?status=${status}`,
    { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY! } }
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'upstream error' }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}
