// export type * from './_types'

export type MatchStatus = 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED'
export type Position = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'

export interface Match {
  id: string
  homeTeam: Team
  awayTeam: Team
  homeGoals: number | null
  awayGoals: number | null
  score?: {
    homeTeamGoals: number | null
    awayTeamGoals: number | null
    homeTeamGoalsHT?: number | null
    awayTeamGoalsHT?: number | null
  }
  status: MatchStatus
  utcDate: string
  competition: League
  minute?: number
  stage?: string
}

export interface Team {
  id: string
  name: string
  shortName?: string
  crest?: string
  founded?: number
  venue?: string
}

export interface Player {
  id: string
  name: string
  position?: Position | string
  nationality?: string
  dateOfBirth?: string
  teamId: string
  photo?: string
  shirtNumber?: number
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

export interface League {
  id: string
  name: string
  code: string
  emblem?: string
}

export interface User {
  id: string
  email: string
  name?: string
  favorites?: Favorite[]
}

export interface Favorite {
  id: string
  userId: string
  type: FavType
  entityId: string
}

export type FavType = 'TEAM' | 'PLAYER' | 'MATCH'