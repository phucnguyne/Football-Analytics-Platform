export interface CareerHistory {
  clubs: {
    id: number
    name: string
    from: string | null
    to: string | null
    seasons: number[]
    source: 'database' | 'api-football'
  }[]
  seasonStats: {
    season: number | null
    matchesPlayed: number
    minutesPlayed: number
    goals: number
    assists: number
  } | null
}
