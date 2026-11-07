import 'server-only'
import { env } from '@/lib/env'

type ApiFootballResponse<T> = { response?: T[] }

function parseMap(value: string | undefined): Record<string, number> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    )
  } catch {
    return {}
  }
}

export function isApiFootballConfigured(): boolean {
  return Boolean(env.API_FOOTBALL_API_KEY)
}

export function getApiFootballFixtureId(localMatchId: number, rawData?: unknown): number | null {
  const raw = rawData && typeof rawData === 'object' && !Array.isArray(rawData)
    ? rawData as Record<string, unknown>
    : {}
  const fixture = raw.fixture && typeof raw.fixture === 'object' ? raw.fixture as Record<string, unknown> : {}
  const direct = [raw.apiFootballFixtureId, raw.fixtureId, fixture.id]
    .find((value): value is number => typeof value === 'number')
  return direct ?? parseMap(env.API_FOOTBALL_FIXTURE_MAP)[String(localMatchId)] ?? null
}

async function request<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  revalidate = 60,
): Promise<T[]> {
  if (!isApiFootballConfigured()) return []
  const url = new URL(path, `${env.API_FOOTBALL_API_URL}/`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value))
  })
  const response = await fetch(url, {
    headers: { 'x-apisports-key': env.API_FOOTBALL_API_KEY as string },
    next: { revalidate },
  })
  if (!response.ok) return []
  const body = await response.json() as ApiFootballResponse<T>
  return body.response ?? []
}

export interface ApiFootballEvent {
  time?: { elapsed?: number; extra?: number | null }
  team?: { id?: number; name?: string }
  player?: { id?: number; name?: string }
  assist?: { id?: number; name?: string }
  type?: string
  detail?: string
  comments?: string | null
  x?: number
  y?: number
  xG?: number
}

interface ApiFootballFixture {
  fixture?: { id?: number }
  teams?: {
    home?: { name?: string }
    away?: { name?: string }
  }
}

export function getFixtureEvents(fixtureId: number): Promise<ApiFootballEvent[]> {
  return request<ApiFootballEvent>('fixtures/events', { fixture: fixtureId })
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|afc|women|w)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export async function resolveApiFootballFixtureId(input: {
  localMatchId: number
  rawData?: unknown
  utcDate: Date
  homeTeamName: string
  awayTeamName: string
}): Promise<number | null> {
  const mapped = getApiFootballFixtureId(input.localMatchId, input.rawData)
  if (mapped || !isApiFootballConfigured()) return mapped

  const fixtures = await request<ApiFootballFixture>('fixtures', {
    date: input.utcDate.toISOString().slice(0, 10),
  }, 86400)
  const home = normalizeTeamName(input.homeTeamName)
  const away = normalizeTeamName(input.awayTeamName)
  const match = fixtures.find((fixture) =>
    normalizeTeamName(fixture.teams?.home?.name ?? '') === home &&
    normalizeTeamName(fixture.teams?.away?.name ?? '') === away
  )
  return match?.fixture?.id ?? null
}

export interface ApiFootballPlayerMatch {
  fixture?: { id?: number; date?: string }
  teams?: {
    home?: { id?: number; name?: string; winner?: boolean | null }
    away?: { id?: number; name?: string; winner?: boolean | null }
  }
  goals?: { total?: number | null; assists?: number | null }
  shots?: { total?: number | null; on?: number | null }
  passes?: { key?: number | null }
  tackles?: { total?: number | null }
  minutes?: number | null
  rating?: string | null
}

interface ApiFootballPlayerSeason {
  league?: { id?: number; name?: string; type?: string }
  games?: {
    appearances?: number | null
    appearences?: number | null
    minutes?: number | null
  }
  goals?: {
    total?: number | null
    assists?: number | null
    conceded?: number | null
    saves?: number | null
  }
  shots?: { total?: number | null }
  passes?: { accuracy?: number | string | null }
  tackles?: { total?: number | null; interceptions?: number | null }
  dribbles?: { success?: number | null; attempts?: number | null }
}

interface ApiFootballPlayerRecord {
  player?: {
    id?: number
    name?: string
    age?: number | null
    nationality?: string | null
    photo?: string | null
  }
  statistics?: ApiFootballPlayerSeason[]
}

export interface ApiFootballSquadPlayer {
  id: number
  name: string
  position: string
  number: number | null
  photo: string | null
}

export interface PlayerSeasonMetrics {
  matchesPlayed: number | null
  minutesPlayed: number | null
  goals: number | null
  assists: number | null
  xG: number | null
  xA: number | null
  shotsPer90: number | null
  passCompletion: number | null
  progressivePasses: number | null
  tacklesPer90: number | null
  interceptions: number | null
  dribblesSuccess: number | null
  savesPer90: number | null
  savePercentage: number | null
  season?: number
  competition?: string
}

function numericValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePlayerName(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function apiFootballPlayerNameMatches(
  providerName: string,
  requestedName: string,
): boolean {
  const providerTokens = normalizePlayerName(providerName)
  const requestedTokens = normalizePlayerName(requestedName)
  if (!providerTokens.length || !requestedTokens.length) return false
  if (providerTokens.join('') === requestedTokens.join('')) return true

  const providerLastName = providerTokens.at(-1)
  const requestedLastName = requestedTokens.at(-1)
  if (providerLastName !== requestedLastName) return false

  const providerFirst = providerTokens[0]
  const requestedFirst = requestedTokens[0]
  if (providerFirst.length === 1) return providerFirst === requestedFirst[0]
  if (requestedFirst.length === 1) return requestedFirst === providerFirst[0]
  return providerTokens.length === 1 && requestedTokens.includes(providerFirst)
}

async function getApiFootballTeamId(teamName: string, season: number): Promise<number | null> {
  if (!env.API_FOOTBALL_LEAGUE_ID) return null
  const teams = await request<{ team?: { id?: number; name?: string } }>('teams', {
    league: env.API_FOOTBALL_LEAGUE_ID,
    season,
  }, 86400)
  const targetName = normalizeTeamName(teamName)
  return teams.find((entry) =>
    normalizeTeamName(entry.team?.name ?? '') === targetName,
  )?.team?.id ?? null
}

export async function getApiFootballTeamSquad(
  teamName: string,
): Promise<ApiFootballSquadPlayer[] | null> {
  if (!isApiFootballConfigured()) return null

  const configuredSeason = Number(env.API_FOOTBALL_SEASON)
  const seasons = [...new Set([2024, configuredSeason, 2023, 2022])]
    .filter((season) => Number.isInteger(season) && season >= 2000)
  for (const season of seasons) {
    const apiTeamId = await getApiFootballTeamId(teamName, season)
    if (!apiTeamId) continue

    const squads = await request<{
      team?: { id?: number }
      players?: {
        id?: number
        name?: string
        position?: string
        number?: number | null
        photo?: string | null
      }[]
    }>('players/squads', { team: apiTeamId }, 86400)
    const squad = squads.find(
      (entry) => String(entry.team?.id) === String(apiTeamId),
    ) ?? (squads.length === 1 ? squads[0] : undefined)
    const players = squad?.players ?? []
    const validPlayers = players.flatMap((player) =>
      player.id && player.name
        ? [{
            id: player.id,
            name: player.name,
            position: player.position ?? '',
            number: player.number ?? null,
            photo: player.photo ?? null,
          }]
        : [],
    )
    if (validPlayers.length > 0) return validPlayers
  }

  return null
}

function toSeasonMetrics(
  stats: ApiFootballPlayerSeason,
  season: number,
): PlayerSeasonMetrics {
  const minutesPlayed = numericValue(stats.games?.minutes)
  const per90 = (value: number | string | null | undefined) => {
    const total = numericValue(value)
    if (total === null || !minutesPlayed) return null
    return Number(((total / minutesPlayed) * 90).toFixed(2))
  }
  const dribbleAttempts = numericValue(stats.dribbles?.attempts)
  const dribbleSuccesses = numericValue(stats.dribbles?.success)
  const saves = numericValue(stats.goals?.saves)
  const goalsConceded = numericValue(stats.goals?.conceded)
  const shotsFaced = saves !== null && goalsConceded !== null
    ? saves + goalsConceded
    : null

  return {
    matchesPlayed: numericValue(stats.games?.appearences ?? stats.games?.appearances),
    minutesPlayed,
    goals: numericValue(stats.goals?.total),
    assists: numericValue(stats.goals?.assists),
    xG: null,
    xA: null,
    shotsPer90: per90(stats.shots?.total),
    passCompletion: numericValue(stats.passes?.accuracy),
    progressivePasses: null,
    tacklesPer90: per90(stats.tackles?.total),
    interceptions: per90(stats.tackles?.interceptions),
    dribblesSuccess:
      dribbleAttempts && dribbleSuccesses !== null
        ? Number(((dribbleSuccesses / dribbleAttempts) * 100).toFixed(2))
        : null,
    savesPer90: per90(stats.goals?.saves),
    savePercentage:
      shotsFaced !== null && shotsFaced > 0 && saves !== null
        ? Number(((saves / shotsFaced) * 100).toFixed(2))
        : null,
    season,
    competition: stats.league?.name ?? 'Unknown competition',
  }
}

export async function getPlayerSeasonMetricsForTeam(
  playerName: string,
  teamName: string,
  season: number,
): Promise<PlayerSeasonMetrics | null> {
  if (!isApiFootballConfigured()) return null
  const apiTeamId = await getApiFootballTeamId(teamName, season)
  if (!apiTeamId) return null

  const currentSquads = await request<{
    team?: { id?: number }
    players?: { id?: number; name?: string }[]
  }>('players/squads', { team: apiTeamId }, 86400)
  const squad = currentSquads.find((entry) => entry.team?.id === apiTeamId)
  const squadMatches = (squad?.players ?? []).filter((player) =>
    player.id && player.name && apiFootballPlayerNameMatches(player.name, playerName),
  )
  let apiPlayerId = squadMatches.length === 1 ? squadMatches[0].id : null

  if (!apiPlayerId) {
    const seasonPlayers = await request<ApiFootballPlayerRecord>('players', {
      team: apiTeamId,
      season,
      league: env.API_FOOTBALL_LEAGUE_ID,
    }, 86400)
    const matches = seasonPlayers.filter((player) =>
      player.player?.id &&
      player.player.name &&
      apiFootballPlayerNameMatches(player.player.name, playerName),
    )
    if (matches.length === 1) apiPlayerId = matches[0].player?.id ?? null
  }
  if (!apiPlayerId) return null

  const playerRecords = await request<ApiFootballPlayerRecord>('players', {
    id: apiPlayerId,
    season,
  }, 86400)
  const record = playerRecords.find((entry) => entry.player?.id === apiPlayerId)
  const selectedStats = [...(record?.statistics ?? [])].sort((a, b) => {
    const aMinutes = numericValue(a.games?.minutes) ?? 0
    const bMinutes = numericValue(b.games?.minutes) ?? 0
    const aLeague = a.league?.type === 'League' ? 1 : 0
    const bLeague = b.league?.type === 'League' ? 1 : 0
    return bLeague - aLeague || bMinutes - aMinutes
  })[0]

  return selectedStats ? toSeasonMetrics(selectedStats, season) : null
}

export async function getPlayerSeasonMetrics(
  localPlayerId: number,
  playerName: string,
): Promise<PlayerSeasonMetrics | null> {
  if (!isApiFootballConfigured()) return null
  const apiPlayerId = await resolveApiFootballPlayerId(localPlayerId, playerName)
  if (!apiPlayerId) return null

  const season = env.API_FOOTBALL_SEASON ?? new Date().getFullYear()
  const playerRecords = await request<ApiFootballPlayerRecord>('players', {
    id: apiPlayerId,
    season,
    league: env.API_FOOTBALL_LEAGUE_ID,
  }, 86400)
  const record = playerRecords.find((entry) => entry.player?.id === apiPlayerId)
  const stats = record?.statistics?.find((entry) =>
    env.API_FOOTBALL_LEAGUE_ID === undefined ||
    entry.league?.id === env.API_FOOTBALL_LEAGUE_ID,
  ) ?? record?.statistics?.[0]
  if (!stats) return null
  return toSeasonMetrics(stats, season)
}

export async function getPlayerMatches(playerId: number): Promise<ApiFootballPlayerMatch[]> {
  return request<ApiFootballPlayerMatch>('players/matches', {
    player: playerId,
    season: env.API_FOOTBALL_SEASON ?? new Date().getFullYear(),
    league: env.API_FOOTBALL_LEAGUE_ID,
  })
}

export function getApiFootballPlayerId(localPlayerId: number): number | null {
  return parseMap(env.API_FOOTBALL_PLAYER_MAP)[String(localPlayerId)] ?? null
}

export async function resolveApiFootballPlayerId(localPlayerId: number, playerName: string): Promise<number | null> {
  const mapped = getApiFootballPlayerId(localPlayerId)
  if (mapped || !isApiFootballConfigured()) return mapped
  const players = await request<{ player?: { id?: number; name?: string } }>('players', {
    search: playerName,
    season: env.API_FOOTBALL_SEASON ?? new Date().getFullYear(),
    league: env.API_FOOTBALL_LEAGUE_ID,
  }, 86400)
  const normalizedName = normalizeTeamName(playerName)
  const exact = players.find((entry) => normalizeTeamName(entry.player?.name ?? '') === normalizedName)
  return exact?.player?.id ?? null
}