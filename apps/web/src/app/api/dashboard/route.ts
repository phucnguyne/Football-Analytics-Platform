import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { getUserId } from '@/lib/auth'
import { isEntityId, upcomingStatuses } from '@/lib/dashboard'

const matchSelect = {
  id: true,
  utcDate: true,
  homeTeam: { select: { name: true } },
  awayTeam: { select: { name: true } },
} as const

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const favorites = await prisma.favorite.findMany({
    where: { userId, entityType: 'TEAM' },
    select: { entityId: true },
  })
  const ids = favorites.map(({ entityId }) => Number(entityId)).filter(isEntityId)

  const [teams, fixtures, recent] = await Promise.all([
    prisma.team.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.match.findMany({
      where: {
        utcDate: { gt: new Date() },
        status: { in: [...upcomingStatuses] },
        OR: [{ homeTeamId: { in: ids } }, { awayTeamId: { in: ids } }],
      },
      select: matchSelect,
      orderBy: [{ utcDate: 'asc' }, { id: 'asc' }],
      take: 12,
    }),
    prisma.prediction.findMany({
      where: { userId },
      select: {
        id: true,
        prediction: true,
        correct: true,
        match: {
          select: { ...matchSelect, status: true, score: { select: { winner: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  const predictions = recent.map(({ match, correct, ...entry }) => {
    const { status, score, ...fixture } = match
    const result = score?.winner === 'HOME' ? 'HOME_WIN'
      : score?.winner === 'AWAY' ? 'AWAY_WIN' : score?.winner
    return {
      ...entry,
      match: fixture,
      correct: correct ?? (status === 'FINISHED' && result ? entry.prediction === result : null),
    }
  })
  const pushPublicKey = process.env.VAPID_PUBLIC_KEY || null
  return NextResponse.json({ teams, fixtures, predictions, pushPublicKey }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
