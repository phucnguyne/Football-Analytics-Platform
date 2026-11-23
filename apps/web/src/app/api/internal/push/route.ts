import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { deliverMatchPush } from '@app/database/src/push-delivery'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const expected = process.env.PUSH_DISPATCH_SECRET
  const received = request.headers.get('x-push-secret')
  if (!expected || expected.length < 32 || !received) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const secret = Buffer.from(expected)
  const candidate = Buffer.from(received)
  if (secret.length !== candidate.length || !timingSafeEqual(secret, candidate)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ sent: await deliverMatchPush(prisma) })
}
