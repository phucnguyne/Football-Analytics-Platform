import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@app/database/src/client'
import { getCurrentUser } from '@/lib/auth'
import { isEntityId } from '@/lib/dashboard'

type Context = { params: Promise<{ id: string }> }
const comment = z.object({ body: z.string().trim().min(1).max(1000) })
const select = {
  id: true, body: true, createdAt: true, userId: true, user: { select: { username: true } },
} as const

export async function GET(request: NextRequest, { params }: Context) {
  const matchId = Number((await params).id)
  const before = request.nextUrl.searchParams.get('before')
  if (!isEntityId(matchId) || (before !== null && !isEntityId(Number(before)))) {
    return NextResponse.json({ error: 'Invalid match or cursor' }, { status: 400 })
  }
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } })
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const [viewer, records] = await Promise.all([
    getCurrentUser(),
    prisma.matchComment.findMany({
      where: { matchId, ...(before ? { id: { lt: Number(before) } } : {}) },
      select,
      orderBy: { id: 'desc' },
      take: 21,
    }),
  ])
  const page = records.slice(0, 20)
  return NextResponse.json({
    comments: page.map(({ id, body, createdAt, user, userId }) => ({
      id, body, createdAt, author: user.username,
      canDelete: viewer?.role === 'ADMIN' || viewer?.id === userId,
    })),
    nextCursor: records.length > 20 ? page.at(-1)?.id : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request, { params }: Context) {
  const viewer = await getCurrentUser()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const matchId = Number((await params).id)
  const parsed = comment.safeParse(await request.json().catch(() => null))
  if (!isEntityId(matchId) || !parsed.success) {
    return NextResponse.json({ error: 'Invalid match or comment' }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`comment:${viewer.id}`}, 0))`
    const match = await tx.match.findUnique({ where: { id: matchId }, select: { id: true } })
    if (!match) return { status: 404, body: { error: 'Match not found' } }
    const recent = await tx.matchComment.count({
      where: { userId: viewer.id, createdAt: { gte: new Date(Date.now() - 60_000) } },
    })
    if (recent >= 5) return { status: 429, body: { error: 'Too many comments' } }
    const saved = await tx.matchComment.create({
      data: { matchId, userId: viewer.id, body: parsed.data.body },
      select: { id: true },
    })
    return { status: 201, body: saved }
  })
  return NextResponse.json(result.body, { status: result.status })
}
