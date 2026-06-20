import type { Team } from './team'
import type { League } from './league'
import type { MatchStatus } from './enums'

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
