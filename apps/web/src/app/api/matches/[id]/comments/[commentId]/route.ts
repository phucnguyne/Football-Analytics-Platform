import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { getCurrentUser } from '@/lib/auth'
import { isEntityId } from '@/lib/dashboard'

export async function DELETE(_request: Request, { params }: {
  params: Promise<{ id: string; commentId: string }>
}) {
  const viewer = await getCurrentUser()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, commentId } = await params
  if (!isEntityId(Number(id)) || !isEntityId(Number(commentId))) {
    return NextResponse.json({ error: 'Invalid match or comment' }, { status: 400 })
  }

  const { count } = await prisma.matchComment.deleteMany({
    where: {
      id: Number(commentId), matchId: Number(id),
      ...(viewer.role === 'ADMIN' ? {} : { userId: viewer.id }),
    },
  })
  return count ? new Response(null, { status: 204 })
    : NextResponse.json({ error: 'Comment not found' }, { status: 404 })
}
