/// <reference types="node" />
/**
 * Unified Football API client.
 * Switch provider via NEXT_PUBLIC_API_PROVIDER env var.
 * Defaults to TheSportsDB (no key required).
 */
import type { Match, Team, Player, Standing, League } from '../types/TypesBarrel'

const SPORTS_DB = process.env.NEXT_PUBLIC_SPORTS_DB_URL ?? 'https://www.thesportsdb.com/api/v1/json/1'
const FD_URL    = process.env.FOOTBALL_DATA_API_URL    ?? 'https://api.football-data.org/v4'
const FD_KEY    = process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY ?? ''

// ── Simple in-memory cache ────────────────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>()
const TTL = 5 * 60 * 1000 // 5 minutes

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < TTL) return hit.data as T
  const data = await fetcher()
  cache.set(key, { data, ts: Date.now() })
  return data
}

// ── TheSportsDB helpers ───────────────────────────────────────
async function sdbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SPORTS_DB}${path}`, { next: { revalidate: 300 } } as any)
  if (!res.ok) throw new Error(`SportsDB error: ${res.status}`)
  return res.json()
}

// ── football-data.org helpers ─────────────────────────────────
async function fdFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${FD_URL}${path}`, {
    headers: { 'X-Auth-Token': FD_KEY },
    next: { revalidate: 60 },
  } as any)
  if (!res.ok) throw new Error(`football-data error: ${res.status}`)
  return res.json()
}

// ══════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════

/** Fetch all teams in a league. leagueId = TheSportsDB league id */
export async function getTeams(leagueId: string): Promise<Team[]> {
  return cached(`teams:${leagueId}`, async () => {
    const data = await sdbFetch<{ teams: any[] }>(`/lookup_all_teams.php?id=${leagueId}`)
    return (data.teams ?? []).map(normalizeTeam)
  })
}

/** Fetch single team details */
export async function getTeam(teamId: string): Promise<Team | null> {
  return cached(`team:${teamId}`, async () => {
    const data = await sdbFetch<{ teams: any[] }>(`/lookupteam.php?id=${teamId}`)
    const t = data.teams?.[0]
    return t ? normalizeTeam(t) : null
  })
}

/** Fetch all players in a team */
export async function getPlayers(teamId: string): Promise<Player[]> {
  return cached(`players:${teamId}`, async () => {
    const data = await sdbFetch<{ player: any[] }>(`/lookup_all_players.php?id=${teamId}`)
    return (data.player ?? []).map(normalizePlayer)
  })
}

/** Fetch single player */
export async function getPlayer(playerId: string): Promise<Player | null> {
  return cached(`player:${playerId}`, async () => {
    const data = await sdbFetch<{ results: any[] }>(`/lookupplayer.php?id=${playerId}`)
    const p = data.results?.[0]
    return p ? normalizePlayer(p) : null
  })
}

/** Last 5 matches for a team */
export async function getTeamRecentMatches(teamId: string): Promise<Match[]> {
  return cached(`matches:team:${teamId}`, async () => {
    const data = await sdbFetch<{ results: any[] }>(`/eventslast.php?id=${teamId}`)
    return (data.results ?? []).map(normalizeMatch)
  })
}

/** All matches in a league (last results) */
export async function getLeagueMatches(leagueId: string): Promise<Match[]> {
  return cached(`matches:league:${leagueId}`, async () => {
    const data = await sdbFetch<{ results: any[] }>(`/eventslastleague.php?id=${leagueId}`)
    return (data.results ?? []).map(normalizeMatch)
  })
}

/** football-data.org – live & scheduled (requires API key) */
export async function getLiveMatches(): Promise<Match[]> {
  if (!FD_KEY) return []
  return cached('matches:live', async () => {
    const data = await fdFetch<{ matches: any[] }>('/matches?status=IN_PLAY')
    return (data.matches ?? []).map(normalizeFdMatch)
  })
}

/** football-data.org – standings (requires API key) */
export async function getStandings(competition = 'PL'): Promise<Standing[]> {
  if (!FD_KEY) return []
  return cached(`standings:${competition}`, async () => {
    const data = await fdFetch<{ standings: any[] }>(`/competitions/${competition}/standings`)
    return data.standings?.[0]?.table?.map(normalizeStanding) ?? []
  })
}

// ══════════════════════════════════════════════════════════════
//  NORMALIZERS  (map raw API shapes → shared types)
// ══════════════════════════════════════════════════════════════
function normalizeTeam(t: any): Team {
  return {
    id:        parseInt(t.idTeam ?? t.id),
    name:      t.strTeam ?? t.name,
    shortName: t.strTeamShort ?? t.shortName ?? t.strTeam?.slice(0, 3).toUpperCase(),
    crest:     t.strTeamBadge ?? t.strBadge ?? t.crest,
    founded:   t.intFormedYear ? parseInt(t.intFormedYear) : undefined,
    venue:     t.strStadium ?? t.venue,
  }
}

function normalizePlayer(p: any): Player {
  return {
    id:           parseInt(p.idPlayer ?? p.id),
    name:         p.strPlayer ?? p.name,
    position:     mapPosition(p.strPosition ?? p.position),
    dateOfBirth:  p.dateBorn ?? p.dateOfBirth,
    nationality:  p.strNationality ?? p.nationality,
    photo:        p.strCutout ?? p.strThumb ?? p.photo,
    shirtNumber:  p.strNumber ? parseInt(p.strNumber) : undefined,
    teamId:       parseInt(p.idTeam ?? p.teamId ?? '0'),
  }
}

function normalizeMatch(m: any): Match {
  return {
    id:      parseInt(m.idEvent ?? m.id),
    utcDate: m.dateEvent ?? m.utcDate ?? new Date().toISOString(),
    status:  mapStatus(m.strStatus ?? m.status),
    stage:   m.strRound ?? m.stage,
    homeTeam: { id: parseInt(m.idHomeTeam ?? '0'), name: m.strHomeTeam ?? '', shortName: '' },
    awayTeam: { id: parseInt(m.idAwayTeam ?? '0'), name: m.strAwayTeam ?? '', shortName: '' },
    score: m.intHomeScore != null ? {
      homeTeamGoals: parseInt(m.intHomeScore),
      awayTeamGoals: parseInt(m.intAwayScore),
    } : undefined,
  }
}

function normalizeFdMatch(m: any): Match {
  return {
    id:      m.id,
    utcDate: m.utcDate,
    status:  m.status as MatchStatus,
    stage:   m.stage,
    homeTeam: normalizeTeam(m.homeTeam),
    awayTeam: normalizeTeam(m.awayTeam),
    score: m.score?.fullTime ? {
      homeTeamGoals: m.score.fullTime.home ?? 0,
      awayTeamGoals: m.score.fullTime.away ?? 0,
    } : undefined,
  }
}

function normalizeStanding(s: any): Standing {
  return {
    position:       s.position,
    team:           normalizeTeam(s.team),
    playedGames:    s.playedGames,
    wins:           s.won,
    draws:          s.draw,
    losses:         s.lost,
    points:         s.points,
    goalsFor:       s.goalsFor,
    goalsAgainst:   s.goalsAgainst,
    goalDifference: s.goalDifference,
  }
}

type MatchStatus = import('@/types/TypesBarrel').MatchStatus
function mapStatus(s: string): MatchStatus {
  const map: Record<string, MatchStatus> = {
    'Match Finished': 'FINISHED', 'FT': 'FINISHED',
    'Not Started': 'SCHEDULED',
    'In Progress': 'IN_PLAY', 'HT': 'PAUSED',
    'Postponed': 'POSTPONED', 'Cancelled': 'CANCELLED',
  }
  return map[s] ?? 'SCHEDULED'
}

function mapPosition(p: string): import('@/types/TypesBarrel').Position {
  const s = p?.toUpperCase() ?? ''
  if (s.includes('GOAL')) return 'GOALKEEPER'
  if (s.includes('DEF'))  return 'DEFENDER'
  if (s.includes('MID'))  return 'MIDFIELDER'
  return 'FORWARD'
}
