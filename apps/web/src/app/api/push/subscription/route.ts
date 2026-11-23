import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@app/database/src/client'
import { getUserId } from '@/lib/auth'
import { endpointSchema, subscriptionSchema } from '@/lib/push-subscription'

const endpointBody = z.object({ endpoint: endpointSchema })
const privateHeaders = { 'Cache-Control': 'private, no-store' }
const endpointLock = (endpoint: string) => `push:${endpoint}`

async function subscription(request: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (request.method === 'PUT') {
    const parsed = subscriptionSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'invalid subscription' }, { status: 400 })
    const { endpoint, keys, locale } = parsed.data
    await prisma.$transaction(async (tx) => {
      // Reassign a shared browser atomically, dropping the other account's queued alerts.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${endpointLock(endpoint)}))`
      await tx.pushSubscription.deleteMany({ where: { endpoint, userId: { not: userId } } })
      await tx.pushSubscription.upsert({
        where: { endpoint },
        create: { endpoint, userId, locale, ...keys },
        update: { locale, ...keys },
      })
    })
    return NextResponse.json({ enabled: true }, { headers: privateHeaders })
  }

  const parsed = endpointBody.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid endpoint' }, { status: 400 })
  const where = { userId, endpoint: parsed.data.endpoint }
  if (request.method === 'DELETE') {
    await prisma.pushSubscription.deleteMany({ where })
    return NextResponse.json({ enabled: false }, { headers: privateHeaders })
  }

  const exists = await prisma.pushSubscription.findFirst({ where, select: { id: true } })
  return NextResponse.json({ enabled: !!exists }, { headers: privateHeaders })
}

export { subscription as POST, subscription as PUT, subscription as DELETE }
