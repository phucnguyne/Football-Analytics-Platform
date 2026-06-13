export type MatchStatus = 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' | 'SUSPENDED'
export type Position    = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'
export type Side        = 'HOME' | 'AWAY'
export type Winner      = 'HOME' | 'AWAY' | 'DRAW'
export type Role        = 'USER' | 'ADMIN'
export type FavType     = 'TEAM' | 'PLAYER' | 'LEAGUE' | 'MATCH'
export type PredResult  = 'HOME_WIN' | 'AWAY_WIN' | 'DRAW'
export type ApiProvider = 'thesportsdb' | 'footballdata' | 'openligadb'

export interface League {
  id:        number
  name:      string
  country:   string
  season:    number
  emblem?:   string
}

export interface Team {
  id:         number
  name:       string
  shortName:  string
  crest?:     string
  founded?:   number
  venue?:     string
  leagueId?:  number
}

export interface TeamWithStats extends Team {
  stats?: TeamStats
}

export interface TeamStats {
  totalMatches:     number
  wins:             number
  draws:            number
  losses:           number
  goalsFor:         number
  goalsAgainst:     number
  avgGoalsPerMatch?: number
}

export interface Player {
  id:           number
  name:         string
  position:     Position
  dateOfBirth?: string
  nationality?: string
  photo?:       string
  shirtNumber?: number
  teamId:       number
  team?:        Team
}

export interface PlayerWithStats extends Player {
  stats?: PlayerStats
}

export interface PlayerStats {
  matchesPlayed: number
  goals:         number
  assists:       number
  yellowCards:   number
  redCards:      number
  minutesPlayed: number
}

export interface Match {
  id:           number
  utcDate:      string
  status:       MatchStatus
  stage?:       string
  lastUpdated?: string
  homeTeam:     Team
  awayTeam:     Team
  league?:      League
  score?:       MatchScore
  statistics?:  MatchStatistic[]
  goals?:       MatchGoal[]
}

export interface MatchScore {
  homeTeamGoals:    number
  awayTeamGoals:    number
  homeTeamGoalsHT?: number
  awayTeamGoalsHT?: number
  winner?:          Winner
}

export interface MatchGoal {
  id:           string
  minute:       number
  minuteExtra?: number
  team:         Side
  scorer:       Player
  assister?:    Player
  penalty:      boolean
  ownGoal:      boolean
}

export interface MatchStatistic {
  team:           Side
  shots?:         number
  shotsOnTarget?: number
  possession?:    number
  passes?:        number
  passAccuracy?:  number
  fouls?:         number
  yellowCards?:   number
  redCards?:      number
  corners?:       number
}

export interface Standing {
  position:      number
  team:          Team
  playedGames:   number
  wins:          number
  draws:         number
  losses:        number
  points:        number
  goalsFor:      number
  goalsAgainst:  number
  goalDifference:number
}

export interface User {
  id:        string
  email:     string
  username:  string
  avatar?:   string
  role:      Role
  createdAt: string
}

export interface ApiResponse<T> {
  success: boolean
  data:    T
  message?: string
  error?:  string
}

export interface PaginatedResponse<T> {
  data:       T[]
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
}

export interface MatchFilters {
  leagueId?:  number
  status?:    MatchStatus
  teamId?:    number
  dateFrom?:  string
  dateTo?:    string
  page?:      number
  pageSize?:  number
}

export interface PlayerFilters {
  teamId?:   number
  position?: Position
  name?:     string
  page?:     number
  pageSize?: number
}

export interface LiveScoreUpdate {
  matchId:   number
  homeGoals: number
  awayGoals: number
  minute:    number
  status:    MatchStatus
}

export interface MatchEvent {
  matchId: number
  type:    'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION'
  minute:  number
  team:    Side
  player?: Player
}
