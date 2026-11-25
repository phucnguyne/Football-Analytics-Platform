export interface ScoutingReportData {
  id: number
  teamName: string
  crest: string | null
  venue: string | null
  founded: number | null
  standing: {
    league: string
    year: number
    updatedAt: string
    position: number
    points: number
    playedGames: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
  } | null
  recentForm: {
    id: number
    date: string
    competition: string
    opponent: string
    isHome: boolean
    goalsFor: number
    goalsAgainst: number
    result: 'W' | 'D' | 'L'
  }[]
  keyPlayers: { id: number; name: string; goals: number; assists: number; matchesPlayed: number }[]
  playerStatsSeason: number | null
}
