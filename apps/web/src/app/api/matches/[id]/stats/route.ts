import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'

/** Weight of each event type when building the momentum curve */
const EVENT_WEIGHT: Record<string, number> = {
  GOAL: 10,
  PENALTY_GOAL: 10,
  OWN_GOAL: -8,    // negative for the scoring team's side
  SHOT: 3,
  YELLOW_CARD: -1,
  RED_CARD: -4,
  PENALTY_MISSED: -2,
}

/** Bucket events into 5-minute windows and compute a cumulative momentum value. */
function buildMomentum(
  events: { minute: number; type: string; team: string }[],
  totalMinutes: number
): { minute: number; value: number }[] {
  // Only include events up to the last known minute (or 90 min)
  const maxMinute = Math.min(Math.max(totalMinutes, 45), 120)
  const BUCKET = 5
  const buckets: Record<number, number> = {}

  for (let m = BUCKET; m <= maxMinute; m += BUCKET) {
    buckets[m] = 0
  }

  for (const ev of events) {
    const bucket = Math.ceil(ev.minute / BUCKET) * BUCKET
    const clampedBucket = Math.min(bucket, maxMinute)
    const w = EVENT_WEIGHT[ev.type] ?? 0
    if (w === 0) continue
    // HOME positive, AWAY negative
    buckets[clampedBucket] = (buckets[clampedBucket] ?? 0) + (ev.team === 'HOME' ? w : -w)
  }

  // Smooth with a rolling cumulative approach
  let cumulative = 0
  return Object.keys(buckets)
    .map(Number)
    .sort((a, b) => a - b)
    .map((minute) => {
      // Decay cumulative toward 0 each bucket then add new weight
      cumulative = Math.round(cumulative * 0.6 + buckets[minute] * 15)
      // Clamp to [-100, 100]
      cumulative = Math.max(-100, Math.min(100, cumulative))
      return { minute, value: cumulative }
    })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const matchId = Number(id)
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return NextResponse.json({ error: 'invalid match id' }, { status: 400 })
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        statistics: true,
        events: {
          select: { minute: true, type: true, team: true },
          orderBy: { minute: 'asc' },
        },
      },
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const home = match.statistics.find((stat) => stat.team === 'HOME') ?? null
    const away = match.statistics.find((stat) => stat.team === 'AWAY') ?? null

    // Determine the last event minute to know how far the match ran
    const lastEventMinute =
      match.events.length > 0
        ? match.events[match.events.length - 1].minute
        : match.status === 'FINISHED'
        ? 90
        : 0

    // Build momentum only if we have events to work with
    const momentumEvents = match.events.filter((e) =>
      Object.prototype.hasOwnProperty.call(EVENT_WEIGHT, e.type)
    )

    const momentum =
      momentumEvents.length > 0
        ? buildMomentum(momentumEvents, lastEventMinute)
        : []

    return NextResponse.json({
      available: home !== null || away !== null,
      possession: { home: home?.possession ?? null, away: away?.possession ?? null },
      shots: { home: home?.shots ?? null, away: away?.shots ?? null },
      shotsOnTarget: {
        home: home?.shotsOnTarget ?? null,
        away: away?.shotsOnTarget ?? null,
      },
      corners: { home: home?.corners ?? null, away: away?.corners ?? null },
      fouls: { home: home?.fouls ?? null, away: away?.fouls ?? null },
      momentum,
    })
  } catch (error) {
    console.error('Error fetching match statistics:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
