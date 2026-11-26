import { NextRequest, NextResponse } from 'next/server'
import prisma from '@app/database/src/client'
import { getFixtureStatistics, resolveApiFootballFixtureId } from '@/lib/api-football'

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
      select: {
        status: true, utcDate: true, minute: true, rawData: true, apiFootballId: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        statistics: true,
        events: {
          select: { minute: true, type: true, team: true, analyticsSource: true },
          orderBy: { minute: 'asc' },
        },
      },
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const storedHome = match.statistics.find((stat) => stat.team === 'HOME')
    const storedAway = match.statistics.find((stat) => stat.team === 'AWAY')
    const playing = match.status === 'IN_PLAY' || match.status === 'PAUSED'
    const hasStarted = playing || match.status === 'FINISHED'
    const providerStats = hasStarted && (playing || !storedHome || !storedAway)
      ? await resolveApiFootballFixtureId({
        localMatchId: matchId, rawData: match.rawData, utcDate: match.utcDate, apiFootballId: match.apiFootballId,
        homeTeamName: match.homeTeam.name, awayTeamName: match.awayTeam.name,
      }).then((fixtureId) => fixtureId
        ? getFixtureStatistics(fixtureId, match.homeTeam.name, match.awayTeam.name)
        : null,
      ).catch(() => null)
      : null
    const home = providerStats?.home ?? storedHome ?? null
    const away = providerStats?.away ?? storedAway ?? null

    // Determine the last event minute to know how far the match ran
    const verifiedEvents = match.events.filter((event) => event.analyticsSource === 'REAL')
    const momentumEvents = (verifiedEvents.length ? verifiedEvents : match.events.filter((event) =>
      event.analyticsSource === null && event.type !== 'SHOT',
    )).filter((event) => Object.prototype.hasOwnProperty.call(EVENT_WEIGHT, event.type))
    const lastEventMinute = Math.max(
      match.minute ?? 0,
      momentumEvents.at(-1)?.minute ?? 0,
      match.status === 'FINISHED' ? 90 : 0,
    )

    const momentum =
      momentumEvents.length > 0
        ? buildMomentum(momentumEvents, lastEventMinute)
        : []

    return NextResponse.json({
      available: home !== null || away !== null,
      source: providerStats?.home || providerStats?.away ? 'api-football' : home || away ? 'database' : 'unavailable',
      possession: { home: home?.possession ?? null, away: away?.possession ?? null },
      shots: { home: home?.shots ?? null, away: away?.shots ?? null },
      shotsOnTarget: {
        home: home?.shotsOnTarget ?? null,
        away: away?.shotsOnTarget ?? null,
      },
      corners: { home: home?.corners ?? null, away: away?.corners ?? null },
      fouls: { home: home?.fouls ?? null, away: away?.fouls ?? null },
      momentum,
      momentumProvenance: momentumEvents.length ? 'real' : 'unavailable',
    })
  } catch (error) {
    console.error('Error fetching match statistics:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
