export const predictionChoices = ['HOME_WIN', 'DRAW', 'AWAY_WIN'] as const
export type PredictionChoice = typeof predictionChoices[number]

export const predictionLabels = { HOME_WIN: 'home', DRAW: 'draw', AWAY_WIN: 'away' } as const
export const upcomingStatuses = ['SCHEDULED', 'TIMED'] as const

type Fixture = {
  id: number
  utcDate: string
  homeTeam: { name: string }
  awayTeam: { name: string }
}

export type DashboardData = {
  pushPublicKey: string | null
  teams: { id: number; name: string }[]
  fixtures: Fixture[]
  predictions: {
    id: string
    match: Fixture
    prediction: PredictionChoice
    correct: boolean | null
  }[]
}

export function isEntityId(id: number) {
  return Number.isInteger(id) && id > 0 && id <= 2_147_483_647
}
