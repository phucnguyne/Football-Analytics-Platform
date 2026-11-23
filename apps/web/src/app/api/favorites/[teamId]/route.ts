import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { getUserId } from '@/lib/auth'
import { isEntityId } from '@/lib/dashboard'

type Context = { params: Promise<{ teamId: string }> }

async function favorite(request: Request, { params }: Context) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = Number((await params).teamId)
  if (!isEntityId(id)) return NextResponse.json({ error: 'invalid team id' }, { status: 400 })

  const key = { userId, entityType: 'TEAM' as const, entityId: String(id) }

  if (request.method === 'PUT') {
    const team = await prisma.team.findUnique({ where: { id }, select: { id: true } })
    if (!team) return NextResponse.json({ error: 'team not found' }, { status: 404 })
    await prisma.favorite.createMany({ data: [key], skipDuplicates: true })
    return NextResponse.json({ favorite: true })
  }

  if (request.method === 'DELETE') {
    await prisma.favorite.deleteMany({ where: key })
    return NextResponse.json({ favorite: false })
  }

  const record = await prisma.favorite.findUnique({
    where: { userId_entityType_entityId: key },
    select: { id: true },
  })
  return NextResponse.json({ favorite: !!record }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export { favorite as GET, favorite as PUT, favorite as DELETE }
