import type { Team } from './team'

export interface League {
  id: string
  name: string
  code: string
  emblem?: string
}

export interface Standing {
  position: number
  team: Team
  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}
