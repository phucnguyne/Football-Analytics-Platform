import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@app/database/src/client'
import { getUserId } from '@/lib/auth'
import { isEntityId, predictionChoices } from '@/lib/dashboard'

type Context = { params: Promise<{ matchId: string }> }
const choiceSchema = z.object({ prediction: z.enum(predictionChoices) })

export async function GET(_request: Request, { params }: Context) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const matchId = Number((await params).matchId)
  if (!isEntityId(matchId)) return NextResponse.json({ error: 'invalid match id' }, { status: 400 })
  const record = await prisma.prediction.findUnique({
    where: { userId_matchId: { userId, matchId } },
    select: { prediction: true },
  })
  return NextResponse.json({ prediction: record?.prediction ?? null }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function PUT(request: Request, { params }: Context) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const matchId = Number((await params).matchId)
  if (!isEntityId(matchId)) return NextResponse.json({ error: 'invalid match id' }, { status: 400 })

  const body = choiceSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'invalid prediction' }, { status: 400 })

  // Lock the fixture row during the write so a concurrent status change cannot
  // move the match into play between checking eligibility and saving the pick.
  const prediction = body.data.prediction
  const saved = await prisma.$transaction(async (tx) => {
    const [match] = await tx.$queryRaw<{ open: boolean }[]>`
      SELECT status IN ('SCHEDULED', 'TIMED')
        AND "utcDate" > (clock_timestamp() AT TIME ZONE 'UTC') AS open
      FROM matches WHERE id = ${matchId} FOR SHARE
    `
    if (!match?.open) return false
    await tx.prediction.upsert({
      where: { userId_matchId: { userId, matchId } },
      create: { userId, matchId, prediction, confidence: 0 },
      update: { prediction, correct: null, createdAt: new Date() },
    })
    return true
  })
  if (!saved) return NextResponse.json({ error: 'match prediction is closed' }, { status: 409 })
  return NextResponse.json({ prediction })
}
