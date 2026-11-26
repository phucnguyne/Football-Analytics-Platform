import { readFileSync, existsSync } from 'node:fs'
import { parse } from 'dotenv'
import { PrismaClient, type Prisma, type PlayerMatchSource } from '@prisma/client'
import { nameKey, providerNumber, rosterNameMatches, teamKey, uniqueMatch } from './player-import-identity'

type Team = { id: number; name: string }
type HFixture = { id: number; date: string; homeTeam: Team; awayTeam: Team; league?: { name?: string }; state?: { description?: string } }
type HPlayer = { id: number; name?: string; fullName?: string; minutesPlayed?: number; matchRating?: string; statistics?: Record<string, unknown> }
type HTeamStats = { team: Team; players: HPlayer[] }
type ApiPlayer = {
  player: { id: number }
  statistics: {
    games?: { minutes?: number; rating?: string }
    goals?: { total?: number; assists?: number }
    shots?: { total?: number }
    passes?: { total?: number; key?: number; accuracy?: number }
    tackles?: { total?: number; interceptions?: number }
    dribbles?: { attempts?: number; success?: number }
  }[]
}
type ApiTeamStats = { team: Team; players: ApiPlayer[] }

const argv = (key: string) => process.argv.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3)
const source = argv('source')
const year = Number(argv('season'))
const limit = Number(argv('limit') ?? 10)
const offset = Number(argv('offset') ?? 0)
const write = process.argv.includes('--write')
const db = new PrismaClient()
const webEnv = new URL('../../../apps/web/.env', import.meta.url)
const web = existsSync(webEnv) ? parse(readFileSync(webEnv)) : {}

function requiredArray<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} did not return the expected list`)
  return value as T[]
}

function formatMetrics(input: Record<string, unknown>) {
  const count = (key: string) => providerNumber(input[key], { integer: true, max: 2000 })
  return {
    goals: count('goalsScored'), assists: count('assists'), shots: count('shotsTotal'),
    passes: count('passesTotal'), passesCompleted: count('passesSuccessful'), keyPasses: count('passesKey'),
    tackles: count('tacklesTotal'), interceptions: count('interceptionsTotal'),
    dribbles: count('dribblesTotal'), dribblesCompleted: count('dribblesSuccessful'),
    xG: providerNumber(input.expectedGoals), xA: providerNumber(input.expectedAssists),
  }
}

async function run() {
  if (!['highlightly', 'api-football'].includes(source ?? '') || !Number.isInteger(year) || year < 1992 ||
      !Number.isInteger(limit) || limit < 1 || limit > 40 || !Number.isInteger(offset) || offset < 0) {
    throw new Error('Use --source=highlightly|api-football --season=YYYY, optional --limit=10 --offset=0 and --write')
  }
  const isHighlightly = source === 'highlightly'
  const key = isHighlightly ? process.env.HIGHLIGHTLY_API_KEY : process.env.API_FOOTBALL_API_KEY || web.API_FOOTBALL_API_KEY
  if (!key) throw new Error(`${isHighlightly ? 'HIGHLIGHTLY_API_KEY' : 'API_FOOTBALL_API_KEY'} is required`)
  const matchSource: PlayerMatchSource = isHighlightly ? 'HIGHLIGHTLY' : 'API_FOOTBALL'
  let calls = 0
  async function request<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const url = new URL(path, isHighlightly ? 'https://soccer.highlightly.net' : 'https://v3.football.api-sports.io')
    url.search = new URLSearchParams(query).toString()
    const headers = { [isHighlightly ? 'x-rapidapi-key' : 'x-apisports-key']: key! }
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000), redirect: 'error' })
    calls++
    if (!response.ok) throw new Error(`${source} ${path} HTTP ${response.status}`)
    return response.json() as Promise<T>
  }

  const fixtures = await db.match.findMany({
    where: {
      leagueId: 2021, status: 'FINISHED', season: { year },
      ...(isHighlightly ? {} : { apiFootballId: { not: null } }),
    },
    select: {
      id: true, apiFootballId: true, utcDate: true,
      homeTeam: { select: { id: true, name: true, shortName: true } },
      awayTeam: { select: { id: true, name: true, shortName: true } },
    },
    orderBy: [{ utcDate: 'desc' }, { id: 'desc' }], skip: offset, take: limit,
  })
  if (!fixtures.length) throw new Error(`No eligible local fixtures for ${year}; import and link this season first`)
  const roster = await db.player.findMany({
    where: isHighlightly ? { teams: { some: {} } } : { apiFootballId: { not: null } },
    select: { id: true, name: true, apiFootballId: true, teams: { select: { teamId: true, from: true, to: true } } },
  })
  const byApiId = new Map(roster.map((player) => [player.apiFootballId, player.id]))
  const highlightlyFixtures = new Map<string, HFixture[]>()
  let matchedFixtures = 0
  let rows = 0
  let skippedPlayers = 0
  for (const fixture of fixtures) {
    const matchesTeam = (name: string, team: typeof fixture.homeTeam) =>
      [team.name, team.shortName].some((entry) => teamKey(entry) === teamKey(name))
    let entries: { team: Team; players: { id?: number; minutes: unknown; rating: unknown; stats: Record<string, unknown> }[] }[]
    if (isHighlightly) {
      const day = fixture.utcDate.toISOString().slice(0, 10)
      let candidates = highlightlyFixtures.get(day)
      if (!candidates) {
        const listing = await request<{ data: HFixture[] }>('/matches', { leagueName: 'Premier League', date: day })
        candidates = requiredArray<HFixture>(listing.data, 'Highlightly fixtures')
        highlightlyFixtures.set(day, candidates)
      }
      const provider = uniqueMatch(candidates, (candidate) =>
        candidate.state?.description === 'Finished' && nameKey(candidate.league?.name) === 'premierleague' &&
        Math.abs(Date.parse(candidate.date) - fixture.utcDate.getTime()) <= 30 * 60_000 &&
        matchesTeam(candidate.homeTeam.name, fixture.homeTeam) && matchesTeam(candidate.awayTeam.name, fixture.awayTeam),
      )
      if (!provider) continue
      const payload = await request<unknown>(`/box-score/${provider.id}`)
      entries = requiredArray<HTeamStats>(payload, 'Highlightly box score').map(({ team, players }) => {
        const club = [fixture.homeTeam, fixture.awayTeam].find((candidate) => matchesTeam(team.name, candidate))
        const membership = roster.filter((candidate) => candidate.teams.some((entry) =>
          entry.teamId === club?.id && (!entry.from || entry.from <= fixture.utcDate) &&
          (!entry.to || entry.to >= fixture.utcDate),
        ))
        return { team, players: requiredArray<HPlayer>(players, 'Highlightly players').map((player) => {
          const names = new Set([nameKey(player.name), nameKey(player.fullName)].filter(Boolean))
          const exact = membership.filter((candidate) => names.has(nameKey(candidate.name)))
          const local = exact.length === 1 ? exact[0] : exact.length === 0
            ? uniqueMatch(membership, (candidate) => rosterNameMatches(candidate.name, player.name, player.fullName))
            : undefined
          return { id: local?.id, minutes: player.minutesPlayed, rating: player.matchRating, stats: player.statistics ?? {} }
        }) }
      })
    } else {
      const payload = await request<{ errors?: Record<string, unknown>; response: ApiTeamStats[] }>('/fixtures/players', { fixture: String(fixture.apiFootballId) })
      const errors = Object.keys(payload.errors ?? {})
      if (errors.length) throw new Error(`API-Football refused fixture ${fixture.id} (${errors.join(', ')})`)
      entries = requiredArray<ApiTeamStats>(payload.response, 'API-Football box score').map(({ team, players }) => ({
        team, players: players.map(({ player, statistics: [stats] }) => ({
          id: byApiId.get(player.id), minutes: stats?.games?.minutes, rating: stats?.games?.rating,
          stats: {
            goalsScored: stats?.goals?.total, assists: stats?.goals?.assists, shotsTotal: stats?.shots?.total,
            passesTotal: stats?.passes?.total, passesKey: stats?.passes?.key,
            tacklesTotal: stats?.tackles?.total, interceptionsTotal: stats?.tackles?.interceptions,
            dribblesTotal: stats?.dribbles?.attempts, dribblesSuccessful: stats?.dribbles?.success,
          },
        })),
      }))
    }
    const records = new Map<number, Prisma.PlayerMatchStatCreateManyInput>()
    const conflicting = new Set<number>()
    for (const entry of entries) {
      const club = uniqueMatch([fixture.homeTeam, fixture.awayTeam], (candidate) => matchesTeam(entry.team.name, candidate))
      if (!club) continue
      for (const player of entry.players) {
        const minutes = providerNumber(player.minutes, { integer: true, max: 130 })
        if (!minutes) continue
        if (!player.id) { skippedPlayers++; continue }
        if (records.has(player.id)) conflicting.add(player.id)
        records.set(player.id, {
          matchId: fixture.id, playerId: player.id, teamId: club.id, source: matchSource,
          minutes, rating: providerNumber(player.rating, { max: 10 }), ...formatMetrics(player.stats),
        })
      }
    }
    for (const id of conflicting) records.delete(id)
    if (records.size) matchedFixtures++
    rows += records.size
    if (write && records.size) await db.$transaction([...records.values()].map((record) =>
      db.playerMatchStat.upsert({
        where: { matchId_playerId_source: { matchId: record.matchId, playerId: record.playerId, source: matchSource } },
        create: record, update: record,
      }),
    ))
    console.log(`Match ${fixture.id}: ${records.size} verified appearances`)
  }
  console.log(JSON.stringify({ source, season: year, mode: write ? 'write' : 'dry-run', fixtures: fixtures.length, matchedFixtures, rows, skippedPlayers, calls }))
}

void run().catch((error: Error) => {
  console.error(error.message)
  process.exitCode = 1
}).finally(() => db.$disconnect())
