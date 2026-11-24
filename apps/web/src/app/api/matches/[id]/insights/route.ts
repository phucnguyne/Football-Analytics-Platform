import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { isEntityId } from '@/lib/dashboard'
import { getInsightSnapshot, loadMatchInsight } from '@/services/match-insight.service'

async function insight(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const generate = request.method === 'POST'
  if (generate && !(await getUserId())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const matchId = Number((await params).id)
  const locale = request.nextUrl.searchParams.get('locale') ?? 'en'
  if (!isEntityId(matchId) || (locale !== 'en' && locale !== 'vi')) {
    return NextResponse.json({ error: 'Invalid match or locale' }, { status: 400 })
  }
  const snapshot = await getInsightSnapshot(matchId)
  if (snapshot === null) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  const result = snapshot ? await loadMatchInsight(matchId, locale, snapshot, generate) : { state: 'unavailable' }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}

export { insight as GET, insight as POST }
