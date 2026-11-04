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
  return exact?.player?.id ?? players[0]?.player?.id ?? null
}