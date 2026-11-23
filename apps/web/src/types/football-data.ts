/** Typed subset of football-data.org responses used by the web application. */
export interface FootballDataTeam {
  id: number
  name: string
  shortName?: string
  tla?: string
  crest?: string | null
  founded?: number | null
  venue?: string | null
  clubColors?: string | null
  address?: string | null
  website?: string | null
  coach?: FootballDataPerson
  formation?: string | null
  lineup?: FootballDataLineupPlayer[]
  bench?: FootballDataLineupPlayer[]
}

export interface FootballDataPerson {
  id: number
  name: string
  position?: string | null
  dateOfBirth?: string | null
  nationality?: string | null
  shirtNumber?: number | null
  photo?: string | null
}

export interface FootballDataLineupPlayer {
  id: number
  name: string
  position?: string | null
  shirtNumber?: number | null
}

export interface FootballDataTeamDetail extends FootballDataTeam {
  squad?: FootballDataPerson[]
  players?: FootballDataPerson[]
}

export interface FootballDataCompetition {
  id: number
  name: string
  code?: string
  emblem?: string | null
}

export interface FootballDataScorePeriod {
  home: number | null
  away: number | null
}

export interface FootballDataScore {
  fullTime?: FootballDataScorePeriod
  halfTime?: FootballDataScorePeriod
}

export interface FootballDataMatch {
  id: number
  utcDate: string
  status: string
  minute?: number | null
  stage?: string | null
  matchday?: number | null
  homeTeam: FootballDataTeam
  awayTeam: FootballDataTeam
  competition?: FootballDataCompetition
  score?: FootballDataScore
}

export interface FootballDataMatchEvent {
  eventType?: string
  minute?: number | null
  injuryTime?: number | null
  type?: string | null
  team?: { id: number; name?: string } | null
  player?: FootballDataLineupPlayer | null
  scorer?: FootballDataLineupPlayer | null
  assist?: FootballDataLineupPlayer | null
  playerOut?: FootballDataLineupPlayer | null
  playerIn?: FootballDataLineupPlayer | null
  card?: string | null
  x?: number | null
  y?: number | null
  xG?: number | null
  analyticsSource?: "REAL" | "GENERATED" | null
}

export interface FootballDataReferee {
  type?: string
  name?: string
  nationality?: string
}

export interface FootballDataMatchDetail extends FootballDataMatch {
  venue?: string | null
  goals?: FootballDataMatchEvent[]
  shots?: FootballDataMatchEvent[]
  bookings?: FootballDataMatchEvent[]
  substitutions?: FootballDataMatchEvent[]
  referees?: FootballDataReferee[]
  prediction?: {
    homeWin: number
    draw: number
    awayWin: number
  } | null
}

export interface FootballDataStanding {
  type?: string
  table?: FootballDataStanding[]
  position: number
  team: FootballDataTeam
  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}
