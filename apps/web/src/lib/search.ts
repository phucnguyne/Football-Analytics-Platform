export const MIN_SEARCH_LENGTH = 2
export const MAX_SEARCH_LENGTH = 80

export type SearchResults = {
  players: { id: number; name: string; team: { name: string } | null }[]
  teams: { id: number; name: string }[]
  matches: { id: number; home: string; away: string; utcDate: string; league: string }[]
}

export function escapeSearchTerm(query: string) {
  return query.replace(/[\\%_]/g, '\\$&')
}

export function splitFixtureQuery(query: string) {
  const [home, away, extra] = query.split(/\s+(?:vs?\.?|versus|[-–—])\s+/i)
  return home && away && !extra ? [home, away] as const : null
}
