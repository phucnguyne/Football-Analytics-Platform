import { existsSync, readFileSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import { parse } from 'dotenv'
import { PrismaClient } from '@prisma/client'

const webEnvFile = new URL('../../../apps/web/.env', import.meta.url)
const web = existsSync(webEnvFile) ? parse(readFileSync(webEnvFile)) : {}
const key = process.env.API_FOOTBALL_API_KEY || web.API_FOOTBALL_API_KEY
const address = process.env.API_FOOTBALL_API_URL || web.API_FOOTBALL_API_URL || 'https://v3.football.api-sports.io'
const leagueId = Number(process.env.API_FOOTBALL_LEAGUE_ID || web.API_FOOTBALL_LEAGUE_ID || '39')
const argument = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const year = Number(argument('season'))
const firstPage = Number(argument('page') ?? 1)
const pageLimit = Number(argument('pages') ?? 57)
const write = process.argv.includes('--write')
const db = new PrismaClient()

interface ProviderResponse<T> {
  response: T[]
  errors?: Record<string, unknown>
  paging?: { total?: number }
}
interface ProviderTeam {
  id: number
  name: string
}
interface PlayerRecord {
  player: { id: number; name?: string; firstname?: string; lastname?: string; birth?: { date?: string } }
  statistics: {
    team?: { id?: number }
    league?: { id?: number; name?: string; season?: number }
    games?: { appearences?: number | null; appearances?: number | null; minutes?: number | null }
    goals?: { total?: number | null; assists?: number | null; saves?: number | null }
    shots?: { total?: number | null }
    tackles?: { total?: number | null; interceptions?: number | null }
    dribbles?: { success?: number | null; attempts?: number | null }
  }[]
}
interface FixtureRecord {
  fixture: { id: number; date: string }
  teams: { home: ProviderTeam; away: ProviderTeam }
}

let calls = 0
let budget: number | undefined
let nextRequestAt = 0

async function request<T>(path: string, extra: Record<string, string> = {}): Promise<ProviderResponse<T>> {
  if (!key) throw new Error('API_FOOTBALL_API_KEY is required')
  if (budget === 0) throw new Error('API-Football daily quota exhausted; resume with --page')
  const url = new URL(`/${path}`, address)
  for (const [k, v] of Object.entries({ league: String(leagueId), season: String(year), ...extra })) url.searchParams.set(k, v)
  for (let attempt = 0; attempt < 2; attempt++) {
    await setTimeout(Math.max(0, nextRequestAt - Date.now()))
    const res = await fetch(url, { headers: { 'x-apisports-key': key }, redirect: 'error', signal: AbortSignal.timeout(12000) })
    calls++
    const remainingDaily = res.headers.get('x-ratelimit-requests-remaining')
    const remainingMinute = res.headers.get('x-ratelimit-remaining')
    if (remainingDaily !== null) budget = Number(remainingDaily)
    nextRequestAt = Date.now() + (remainingMinute === '0' ? 61000 : 300)
    if (res.status === 429 && attempt === 0 && budget !== 0) {
      nextRequestAt = Date.now() + Math.max(1000, Number(res.headers.get('retry-after') ?? 60) * 1000)
      continue
    }
    if (!res.ok) throw new Error(`API-Football ${path} returned HTTP ${res.status}`)
    const payload: ProviderResponse<T> = await res.json()
    const errors = Object.keys(payload.errors ?? {})
    if (errors.length) throw new Error(`API-Football ${path} refused the request (${errors.join(', ')})`)
    return payload
  }
  throw new Error(`API-Football ${path} rate limit exceeded`)
}

function words(name?: string) {
  return (name ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

const teamAliases: Record<string, string> = {
  brightonhovealbion: 'brighton', newcastleunited: 'newcastle',
  wolverhamptonwanderers: 'wolves', wolverhampton: 'wolves',
  westhamunited: 'westham', tottenhamhotspur: 'tottenham',
  ipswichtown: 'ipswich', leicestercity: 'leicester',
}

function teamKey(name: string) {
  const normalized = words(name).filter((part) => !['fc', 'afc', 'cf', 'and'].includes(part)).join('')
  return teamAliases[normalized] ?? normalized
}

function matchesName(local: string, provider: PlayerRecord['player']) {
  const actual = words(local)
  const candidates = [words(provider.name), words(`${provider.firstname ?? ''} ${provider.lastname ?? ''}`)]
  return actual.length > 0 && candidates.some((candidate) =>
    candidate.join('') === actual.join('') ||
    (candidate.length > 1 && actual.length > 1 && candidate.at(-1) === actual.at(-1) && candidate[0][0] === actual[0][0]),
  )
}

const nullableNumber = (value?: number | null) => typeof value === 'number' && Number.isFinite(value) ? value : null
function readMetrics(row: PlayerRecord['statistics'][number]) {
  const minutes = nullableNumber(row.games?.minutes)
  const per90 = (total?: number | null) => typeof total === 'number' && minutes && minutes > 0
    ? Number((total * 90 / minutes).toFixed(2)) : null
  const attempts = nullableNumber(row.dribbles?.attempts)
  const success = nullableNumber(row.dribbles?.success)
  return {
    matchesPlayed: nullableNumber(row.games?.appearences ?? row.games?.appearances), minutesPlayed: minutes,
    goals: nullableNumber(row.goals?.total), assists: nullableNumber(row.goals?.assists),
    xG: null, xA: null, shotsPer90: per90(row.shots?.total), passCompletion: null, progressivePasses: null,
    tacklesPer90: per90(row.tackles?.total), interceptions: per90(row.tackles?.interceptions),
    dribblesSuccess: attempts && success !== null ? Number((success * 100 / attempts).toFixed(2)) : null,
    savesPer90: per90(row.goals?.saves), savePercentage: null,
    season: year, competition: row.league?.name ?? 'Premier League',
  }
}

type Link = { local_id: number; provider_id: number }
type Snapshot = { player_id: number; team_id: number; season_id: number; metrics: ReturnType<typeof readMetrics> }

async function main() {
  if (!Number.isInteger(year) || year < 1992 || !Number.isInteger(firstPage) || firstPage < 1 || !Number.isInteger(pageLimit) || pageLimit < 1) {
    throw new Error('Specify --season=YYYY and optional positive --page and --pages; add --write to persist')
  }
  if (leagueId !== 39) throw new Error('This import is configured for API-Football Premier League (39)')
  const season = await db.season.findUnique({ where: { leagueId_year: { leagueId: 2021, year } },
    select: { id: true, teams: { select: { team: { select: { id: true, name: true, shortName: true } } } } } })
  if (!season) throw new Error(`Import the official football-data.org Premier League season ${year} first`)

  const [localMatches, localPlayers] = await Promise.all([
    db.match.findMany({ where: { seasonId: season.id }, select: { id: true, apiFootballId: true, utcDate: true, homeTeamId: true, awayTeamId: true } }),
    db.player.findMany({ where: { OR: [{ dateOfBirth: { not: null } }, { apiFootballId: { not: null } }] },
      select: { id: true, name: true, dateOfBirth: true, apiFootballId: true } }),
  ])
  const teams = await request<{ team: ProviderTeam }>('teams')
  const mappedTeams = new Map(teams.response.flatMap(({ team }) => {
    const matches = season.teams.filter(({ team: local }) => [local.name, local.shortName].some((name) => teamKey(name) === teamKey(team.name)))
    return matches.length === 1 ? [[team.id, matches[0].team.id] as const] : []
  }))
  const links: Link[] = []
  if (firstPage === 1) {
    const fixtures = await request<FixtureRecord>('fixtures')
    const localById = new Map(localMatches.filter((match) => match.apiFootballId).map((match) => [match.apiFootballId, match.id]))
    for (const record of fixtures.response) {
      const home = mappedTeams.get(record.teams.home.id)
      const away = mappedTeams.get(record.teams.away.id)
      const kickoff = Date.parse(record.fixture.date)
      const candidates = localMatches.filter((match) =>
        match.homeTeamId === home && match.awayTeamId === away && Math.abs(match.utcDate.valueOf() - kickoff) <= 3 * 60 * 60_000,
      )
      if (candidates.length !== 1) continue
      const [match] = candidates
      if ((match.apiFootballId ?? record.fixture.id) !== record.fixture.id ||
        (localById.get(record.fixture.id) ?? match.id) !== match.id) continue
      links.push({ local_id: match.id, provider_id: record.fixture.id })
    }
    if (write && links.length) await db.$executeRaw`
      UPDATE "matches" AS m SET "apiFootballId" = data.provider_id
      FROM jsonb_to_recordset(${JSON.stringify(links)}::jsonb) AS data(local_id integer, provider_id integer)
      WHERE m.id = data.local_id AND m."apiFootballId" IS NULL
    `
  }

  const playersByProviderId = new Map(localPlayers.filter((player) => player.apiFootballId).map((player) => [player.apiFootballId, player]))
  let playerCount = 0
  let seasonRows = 0
  let page = firstPage
  for (; page < firstPage + pageLimit; page++) {
    const result = await request<PlayerRecord>('players', { page: String(page) })
    const playerLinks: Link[] = []
    const metrics = new Map<string, Snapshot>()
    for (const row of result.response) {
      const candidates = localPlayers.filter((player) => player.apiFootballId === null && row.player.birth?.date &&
        player.dateOfBirth?.toISOString().slice(0, 10) === row.player.birth.date && matchesName(player.name, row.player))
      const local = playersByProviderId.get(row.player.id) ?? (candidates.length === 1 ? candidates[0] : undefined)
      if (!local || (local.apiFootballId ?? row.player.id) !== row.player.id) continue
      if (local.apiFootballId === null) {
        local.apiFootballId = row.player.id
        playersByProviderId.set(row.player.id, local)
        playerLinks.push({ local_id: local.id, provider_id: row.player.id })
      }
      for (const entry of row.statistics) {
        const teamId = mappedTeams.get(entry.team?.id ?? 0)
        if (!teamId || entry.league?.id !== leagueId || entry.league.season !== year) continue
        const snapshot = { player_id: local.id, team_id: teamId, season_id: season.id, metrics: readMetrics(entry) }
        if (snapshot.metrics.matchesPlayed === null && snapshot.metrics.minutesPlayed === null) continue
        metrics.set(`${local.id}:${teamId}`, snapshot)
      }
    }
    if (write && (playerLinks.length || metrics.size)) {
      await db.$transaction(async (tx) => {
        if (playerLinks.length) await tx.$executeRaw`
          UPDATE "players" AS p SET "apiFootballId" = data.provider_id
          FROM jsonb_to_recordset(${JSON.stringify(playerLinks)}::jsonb) AS data(local_id integer, provider_id integer)
          WHERE p.id = data.local_id AND p."apiFootballId" IS NULL
        `
        if (metrics.size) await tx.$executeRaw`
          INSERT INTO "api_football_player_seasons" ("playerId", "teamId", "seasonId", metrics, "updatedAt")
          SELECT player_id, team_id, season_id, metrics, now()
          FROM jsonb_to_recordset(${JSON.stringify([...metrics.values()])}::jsonb)
            AS data(player_id integer, team_id integer, season_id integer, metrics jsonb)
          ON CONFLICT ("playerId", "teamId", "seasonId") DO UPDATE
          SET metrics = EXCLUDED.metrics, "updatedAt" = EXCLUDED."updatedAt"
        `
      }, { maxWait: 10000, timeout: 30000 })
    }
    playerCount += playerLinks.length
    seasonRows += metrics.size
    console.log(`Page ${page}: ${metrics.size} verified player-season rows`)
    if (page >= (result.paging?.total ?? page)) { page++; break }
  }
  console.log(JSON.stringify({ year, mode: write ? 'write' : 'dry-run', clubs: mappedTeams.size,
    fixtures: links.length, newPlayerLinks: playerCount, seasonRows, providerCalls: calls, nextPage: page }))
}

void main().catch((error: Error) => {
  console.error(error.message)
  process.exitCode = 1
}).finally(() => db.$disconnect())
