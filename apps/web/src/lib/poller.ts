import prisma from '@app/database/src/client'

const API_URL = process.env.FOOTBALL_DATA_API_URL ?? 'https://api.football-data.org/v4'
const API_KEY = process.env.FOOTBALL_DATA_API_KEY ?? ''

type PollerState = 'LIVE' | 'PRE_MATCH' | 'IDLE' | 'NIGHT'

interface MatchUpdate {
  matchId: number
  status: string
  minute: number | null
  homeTeamId: number
  homeTeamName: string
  homeTeamCrest: string | null
  homeTeamShortName: string
  awayTeamId: number
  awayTeamName: string
  awayTeamCrest: string | null
  awayTeamShortName: string
  homeGoals: number | null
  awayGoals: number | null
  competition: string
  matchday: number | null
}

type Listener = (updates: MatchUpdate[]) => void

const INTERVALS: Record<PollerState, number> = {
  LIVE: 60_000,        // 60s when matches are active
  PRE_MATCH: 300_000,  // 5 min when matches today but not started
  IDLE: 1_800_000,     // 30 min when no matches today
  NIGHT: 0,            // off
}

class SmartPoller {
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private listeners = new Set<Listener>()
  private currentState: PollerState = 'IDLE'
  private lastPollTime = 0

  /** Subscribe to match updates. Returns unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    this.ensureRunning()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.stop()
    }
  }

  private broadcast(updates: MatchUpdate[]) {
    for (const listener of this.listeners) {
      try { listener(updates) } catch (e) { console.error('[Poller] listener error:', e) }
    }
  }

  private ensureRunning() {
    if (!this.running) this.start()
  }

  start() {
    if (this.running) return
    this.running = true
    console.log('[Poller] Started')
    this.tick()
  }

  stop() {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    console.log('[Poller] Stopped')
  }

  private async tick() {
    if (!this.running) return

    try {
      const state = await this.detectState()
      this.currentState = state

      if (state === 'NIGHT') {
        // Schedule next check in 30 min
        this.scheduleNext(1_800_000)
        return
      }

      const updates = await this.poll()
      if (updates.length > 0) {
        this.broadcast(updates)
      }

      this.scheduleNext(INTERVALS[state])
    } catch (error) {
      console.error('[Poller] tick error:', error)
      // Retry in 2 minutes on error
      this.scheduleNext(120_000)
    }
  }

  private scheduleNext(ms: number) {
    if (!this.running) return
    this.timer = setTimeout(() => this.tick(), ms)
  }

  /** Determine polling state based on today's match schedule */
  private async detectState(): Promise<PollerState> {
    const now = new Date()
    const hour = now.getHours()

    // Night mode: 0–6 AM
    if (hour >= 0 && hour < 6) return 'NIGHT'

    // Check DB for today's matches
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const todayMatches = await prisma.match.findMany({
      where: {
        utcDate: { gte: todayStart, lte: todayEnd },
      },
      select: { status: true, utcDate: true },
    })

    if (todayMatches.length === 0) return 'IDLE'

    // Any match currently live?
    const hasLive = todayMatches.some(m =>
      m.status === 'IN_PLAY' || m.status === 'PAUSED'
    )
    if (hasLive) return 'LIVE'

    // Any match starting within 10 minutes?
    const tenMinFromNow = new Date(now.getTime() + 10 * 60_000)
    const hasUpcoming = todayMatches.some(m =>
      (m.status === 'SCHEDULED' || m.status === 'TIMED') &&
      m.utcDate <= tenMinFromNow
    )
    if (hasUpcoming) return 'LIVE' // switch to fast polling just before kickoff

    // Matches today but not started yet
    const hasScheduled = todayMatches.some(m =>
      m.status === 'SCHEDULED' || m.status === 'TIMED'
    )
    if (hasScheduled) return 'PRE_MATCH'

    return 'IDLE'
  }

  /** Single API call to get today's matches, upsert to DB, return changes */
  private async poll(): Promise<MatchUpdate[]> {
    const today = new Date().toISOString().split('T')[0]
    console.log(`[Poller] Polling (state: ${this.currentState}) for ${today}`)

    const res = await fetch(`${API_URL}/matches?date=${today}`, {
      headers: { 'X-Auth-Token': API_KEY },
    })

    if (!res.ok) {
      console.warn(`[Poller] API returned ${res.status}`)
      return []
    }

    const data = await res.json()
    const apiMatches = data.matches ?? []
    const updates: MatchUpdate[] = []

    for (const m of apiMatches) {
      // Only process matches we have in our DB
      const existing = await prisma.match.findUnique({
        where: { id: m.id },
        include: { score: true, homeTeam: true, awayTeam: true, league: true },
      })

      if (!existing) continue

      const newStatus = m.status
      const newHomeGoals = m.score?.fullTime?.home ?? null
      const newAwayGoals = m.score?.fullTime?.away ?? null
      const oldHomeGoals = existing.score?.homeTeamGoals ?? null
      const oldAwayGoals = existing.score?.awayTeamGoals ?? null

      // Detect if anything changed
      const statusChanged = existing.status !== newStatus
      const scoreChanged = oldHomeGoals !== newHomeGoals || oldAwayGoals !== newAwayGoals

      if (statusChanged || scoreChanged) {
        // Update match status
        await prisma.match.update({
          where: { id: m.id },
          data: {
            status: newStatus,
            minute: m.minute ?? null,
            lastUpdated: new Date(),
          },
        })

        // Upsert score
        if (newHomeGoals !== null) {
          const winner = m.score?.winner === 'HOME_TEAM' ? 'HOME' as const
            : m.score?.winner === 'AWAY_TEAM' ? 'AWAY' as const
            : m.score?.winner === 'DRAW' ? 'DRAW' as const
            : null

          await prisma.matchScore.upsert({
            where: { matchId: m.id },
            update: {
              homeTeamGoals: newHomeGoals,
              awayTeamGoals: newAwayGoals ?? 0,
              homeTeamGoalsHT: m.score?.halfTime?.home,
              awayTeamGoalsHT: m.score?.halfTime?.away,
              winner,
            },
            create: {
              matchId: m.id,
              homeTeamGoals: newHomeGoals,
              awayTeamGoals: newAwayGoals ?? 0,
              homeTeamGoalsHT: m.score?.halfTime?.home,
              awayTeamGoalsHT: m.score?.halfTime?.away,
              winner,
            },
          })
        }

        updates.push({
          matchId: m.id,
          status: newStatus,
          minute: m.minute ?? null,
          homeTeamId: existing.homeTeam.id,
          homeTeamName: existing.homeTeam.name,
          homeTeamCrest: existing.homeTeam.crest,
          homeTeamShortName: existing.homeTeam.shortName,
          awayTeamId: existing.awayTeam.id,
          awayTeamName: existing.awayTeam.name,
          awayTeamCrest: existing.awayTeam.crest,
          awayTeamShortName: existing.awayTeam.shortName,
          homeGoals: newHomeGoals,
          awayGoals: newAwayGoals,
          competition: existing.league.name,
          matchday: existing.matchday,
        })
      }
    }

    if (updates.length > 0) {
      console.log(`[Poller] ${updates.length} match(es) updated`)
    }

    this.lastPollTime = Date.now()
    return updates
  }

  getState() {
    return {
      running: this.running,
      state: this.currentState,
      listeners: this.listeners.size,
      lastPoll: this.lastPollTime ? new Date(this.lastPollTime).toISOString() : null,
    }
  }
}

// Singleton
const globalForPoller = globalThis as unknown as { poller?: SmartPoller }
export const poller = globalForPoller.poller ?? new SmartPoller()
if (process.env.NODE_ENV !== 'production') globalForPoller.poller = poller

