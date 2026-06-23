/// <reference types="node" />
/**
 * Football API client backed by football-data.org.
 * Free tier: 100 requests/day. Requires NEXT_PUBLIC_FOOTBALL_DATA_API_KEY.
 */
import type { Match, Team, Player, Standing, League, MatchStatus, Position } from '../types/TypesBarrel'

// const SPORTS_DB = process.env.NEXT_PUBLIC_SPORTS_DB_URL ?? 'https://www.thesportsdb.com/api/v1/json/1'
const FD_URL = process.env.FOOTBALL_DATA_API_URL ?? 'https://api.football-data.org/v4'
const FD_KEY = process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY ?? 'server-side-auth'

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

// ── TheSportsDB helpers (disabled) ────────────────────────────
// async function sdbFetch<T>(path: string): Promise<T> {
//   const res = await fetch(`${SPORTS_DB}${path}`, { next: { revalidate: 300 } } as any)
//   if (!res.ok) throw new Error(`SportsDB error: ${res.status}`)
//   return res.json()
// }

async function fdFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)   // e.g. /api/matches?competition=PL
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// ══════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════

// /** (disabled) Fetch all teams in a league. leagueId = TheSportsDB league id */
// export async function getTeams(leagueId: string): Promise<Team[]> {
//   return cached(`teams:${leagueId}`, async () => {
//     const data = await sdbFetch<{ teams: any[] }>(`/lookup_all_teams.php?id=${leagueId}`)
//     return (data.teams ?? []).map(normalizeTeam)
//   })
// }

/** Fetch all teams in a competition. competitionCode e.g. 'PL' */
export async function getTeams(competitionCode: string): Promise<Team[]> {
  return cached(`teams:${competitionCode}`, async () => {
    const data = await fdFetch<{ teams: any[] }>(`/competitions/${competitionCode}/teams`)
    return (data.teams ?? []).map(normalizeTeam)
  })
}

// /** (disabled) Fetch single team details */
// export async function getTeam(teamId: string): Promise<Team | null> {
//   return cached(`team:${teamId}`, async () => {
//     const data = await sdbFetch<{ teams: any[] }>(`/lookupteam.php?id=${teamId}`)
//     const t = data.teams?.[0]
//     return t ? normalizeTeam(t) : null
//   })
// }

/** Fetch single team details */
export async function getTeam(teamId: string): Promise<Team | null> {
  return cached(`team:${teamId}`, async () => {
    const t = await fdFetch<any>(`/teams/${teamId}`)
    return t ? normalizeTeam(t) : null
  })
}

// /** (disabled) Fetch all players in a team */
// export async function getPlayers(teamId: string): Promise<Player[]> {
//   return cached(`players:${teamId}`, async () => {
//     const data = await sdbFetch<{ player: any[] }>(`/lookup_all_players.php?id=${teamId}`)
//     return (data.player ?? []).map(normalizePlayer)
//   })
// }

/** Fetch all players (squad) for a team */
export async function getPlayers(teamId: string): Promise<Player[]> {
  return cached(`players:${teamId}`, async () => {
    const data = await fdFetch<{ squad: any[]; players: any[]; id: number }>(`/teams/${teamId}`)
    const roster = data.squad ?? data.players ?? []
    return roster.map((p) => normalizePlayer(p, String(data.id)))
  })
}

// /** (disabled) Fetch single player */
// export async function getPlayer(playerId: string): Promise<Player | null> {
//   return cached(`player:${playerId}`, async () => {
//     const data = await sdbFetch<{ results: any[] }>(`/lookupplayer.php?id=${playerId}`)
//     const p = data.results?.[0]
//     return p ? normalizePlayer(p) : null
//   })
// }

/** Fetch single player */
export async function getPlayer(playerId: string): Promise<Player | null> {
  return cached(`player:${playerId}`, async () => {
    const p = await fdFetch<any>(`/persons/${playerId}`)
    return p ? normalizePlayer(p, String(p.currentTeam?.id ?? '0')) : null
  })
}

// /** (disabled) Last 5 matches for a team */
// export async function getTeamRecentMatches(teamId: string): Promise<Match[]> {
//   return cached(`matches:team:${teamId}`, async () => {
//     const data = await sdbFetch<{ results: any[] }>(`/eventslast.php?id=${teamId}`)
//     return (data.results ?? []).map(normalizeMatch)
//   })
// }

/** Recent finished matches for a team (last 5) */
export async function getTeamRecentMatches(teamId: string): Promise<Match[]> {
  return cached(`matches:team:${teamId}`, async () => {
    const data = await fdFetch<{ matches: any[] }>(`/teams/${teamId}/matches?status=FINISHED&limit=5`)
    return (data.matches ?? []).map(normalizeMatch)
  })
}

// /** (disabled) All matches in a league (last results) */
// export async function getLeagueMatches(leagueId: string): Promise<Match[]> {
//   return cached(`matches:league:${leagueId}`, async () => {
//     const data = await sdbFetch<{ results: any[] }>(`/eventslastleague.php?id=${leagueId}`)
//     return (data.results ?? []).map(normalizeMatch)
//   })
// }

/** All matches in a competition (recent results) */
export async function getLeagueMatches(competitionCode: string): Promise<Match[]> {
  return cached(`matches:competition:${competitionCode}`, async () => {
    const data = await fdFetch<{ matches: any[] }>(`/competitions/${competitionCode}/matches?status=FINISHED`)

    return (data.matches ?? []).map(normalizeMatch)
  })
}

/** Live & in-play matches across all competitions */
export async function getLiveMatches(): Promise<Match[]> {
  return cached('matches:live', async () => {
    const data = await fdFetch<{ matches: any[] }>('/matches?status=LIVE,IN_PLAY,PAUSED')
    return (data.matches ?? []).map(normalizeMatch)
  })
}

/** Standings table for a competition */
export async function getStandings(competition = 'PL'): Promise<Standing[]> {
  return cached(`standings:${competition}`, async () => {
    const data = await fdFetch<{ standings: any[] }>(`/competitions/${competition}/standings`)
    const table = data.standings?.find((s) => s.type === 'TOTAL')?.table ?? data.standings?.[0]?.table
    return (table ?? []).map(normalizeStanding)
  })
}

// ══════════════════════════════════════════════════════════════
//  NORMALIZERS  (map football-data.org shapes → shared types)
// ══════════════════════════════════════════════════════════════
function normalizeTeam(t: any): Team {
  return {
    id:        String(t.id),
    name:      t.name,
    shortName: t.shortName ?? t.tla ?? t.name?.slice(0, 3).toUpperCase(),
    crest:     t.crest,
    founded:   t.founded ?? undefined,
    venue:     t.venue ?? undefined,
  }
}

function normalizePlayer(p: any, teamId: string): Player {
  return {
    id:           String(p.id),
    name:         p.name,
    position:     mapPosition(p.position),
    dateOfBirth:  p.dateOfBirth,
    nationality:  p.nationality,
    photo:        p.photo ?? undefined,
    shirtNumber:  p.shirtNumber ?? undefined,
    teamId,
  }
}

// /** (disabled) TheSportsDB shape normalizer */
// function normalizeMatchSDB(m: any): Match {
//   return {
//     id:      String(m.idEvent ?? m.id),
//     utcDate: m.dateEvent ?? m.utcDate ?? new Date().toISOString(),
//     status:  mapStatus(m.strStatus ?? m.status),
//     stage:   m.strRound ?? m.stage,
//     homeTeam: { id: String(m.idHomeTeam ?? '0'), name: m.strHomeTeam ?? '', shortName: '' },
//     awayTeam: { id: String(m.idAwayTeam ?? '0'), name: m.strAwayTeam ?? '', shortName: '' },
//     homeGoals: m.intHomeScore != null ? parseInt(m.intHomeScore) : null,
//     awayGoals: m.intAwayScore != null ? parseInt(m.intAwayScore) : null,
//     competition: { id: String(m.idLeague ?? '0'), name: m.strLeague ?? '', code: '' },
//     score: m.intHomeScore != null ? {
//       homeTeamGoals: parseInt(m.intHomeScore),
//       awayTeamGoals: parseInt(m.intAwayScore),
//     } : undefined,
//   }
// }
//
// function mapStatus(s: string): MatchStatus {
//   const map: Record<string, MatchStatus> = {
//     'Match Finished': 'FINISHED', 'FT': 'FINISHED',
//     'Not Started': 'SCHEDULED',
//     'In Progress': 'IN_PLAY', 'HT': 'PAUSED',
//     'Postponed': 'POSTPONED', 'Cancelled': 'CANCELLED',
//   }
//   return map[s] ?? 'SCHEDULED'
// }

function normalizeMatch(m: any): Match {
  return {
    id:      String(m.id),
    utcDate: m.utcDate,
    status:  m.status as MatchStatus,
    minute:  m.minute ?? undefined,
    stage:   m.stage,
    homeTeam: normalizeTeam(m.homeTeam),
    awayTeam: normalizeTeam(m.awayTeam),
    homeGoals: m.score?.fullTime?.home ?? null,
    awayGoals: m.score?.fullTime?.away ?? null,
    competition: normalizeLeague(m.competition ?? {}),
    score: m.score ? {
      homeTeamGoals: m.score.fullTime?.home ?? null,
      awayTeamGoals: m.score.fullTime?.away ?? null,
      homeTeamGoalsHT: m.score.halfTime?.home ?? null,
      awayTeamGoalsHT: m.score.halfTime?.away ?? null,
    } : undefined,
  }
}

function normalizeLeague(c: any): League {
  return {
    id:     String(c.id ?? '0'),
    name:   c.name ?? '',
    code:   c.code ?? '',
    emblem: c.emblem ?? undefined,
  }
}

function normalizeStanding(s: any): Standing {
  return {
    position:       s.position,
    team:           normalizeTeam(s.team),
    playedGames:    s.playedGames,
    won:            s.won,
    draw:           s.draw,
    lost:           s.lost,
    points:         s.points,
    goalsFor:       s.goalsFor,
    goalsAgainst:   s.goalsAgainst,
    goalDifference: s.goalDifference,
  }
}



function mapPosition(p: string): Position {
  const s = p?.toUpperCase() ?? ''
  if (s.includes('GOAL') || s.includes('KEEPER')) return 'GOALKEEPER'
  if (s.includes('BACK') || s.includes('DEF'))     return 'DEFENDER'
  if (s.includes('MID'))                           return 'MIDFIELDER'
  return 'FORWARD'
}