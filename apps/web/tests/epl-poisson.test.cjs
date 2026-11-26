jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/env', () => ({ env: { FOOTBALL_DATA_API_URL: 'https://example.test' } }))

const { computeMatchProbabilities } = require('@/lib/poisson')
const { fitPremierLeaguePoisson } = require('@/lib/epl-poisson')
const { getSeasonPrediction } = require('@/services/season-prediction.service')

test('Premier League model fits the bundled results and excludes same-day and future scores', () => {
  const now = new Date('2026-11-26T14:00:00Z')
  const archive = fitPremierLeaguePoisson([], now)
  const fitted = fitPremierLeaguePoisson([
    { date: '2026-11-25', home: 'Arsenal', away: 'Aston Villa', homeGoals: 3, awayGoals: 0 },
    { date: '2026-11-26', home: 'Arsenal', away: 'Chelsea', homeGoals: 8, awayGoals: 0 },
    { date: '2026-11-27', home: 'Arsenal', away: 'Chelsea', homeGoals: 8, awayGoals: 0 },
  ], now)
  expect(archive.historyMatches).toBe(3040)
  expect(fitted.historyMatches).toBe(3041)
  const { home, away } = fitted.expectedGoals('Arsenal FC', 'Chelsea FC')
  expect(home).toBeGreaterThan(0)
  expect(away).toBeGreaterThan(0)
  const probabilities = computeMatchProbabilities(home, away, 15)
  expect(Math.abs(probabilities.homeWin + probabilities.draw + probabilities.awayWin - 100)).toBeLessThan(0.2)
})

test('the provider result replaces the matching historical fixture for fitting', () => {
  const now = new Date('2026-11-26')
  const model = fitPremierLeaguePoisson([
    { date: '2025-08-15', home: 'Liverpool', away: 'Bournemouth', homeGoals: 4, awayGoals: 2 },
  ], now)
  expect(model.historyMatches).toBe(3040)
})

test('season simulations use the same historical model and keep recorded points', async () => {
  jest.useFakeTimers({ now: new Date('2026-11-26T14:00:00Z') })
  const arsenal = { id: 57, name: 'Arsenal FC' }
  const chelsea = { id: 61, name: 'Chelsea FC' }
  const provider = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(Response.json({ name: 'Premier League', currentSeason: { startDate: '2026-08-21' } }))
    .mockResolvedValueOnce(Response.json({ matches: [
      { utcDate: '2026-10-01T19:00Z', status: 'FINISHED', homeTeam: arsenal, awayTeam: chelsea,
        score: { fullTime: { home: 2, away: 1 } } },
      { utcDate: '2026-12-01T19:00Z', status: 'TIMED', homeTeam: chelsea, awayTeam: arsenal },
    ] }))
  try {
    const result = await getSeasonPrediction()
    expect(result.data).toMatchObject({
      season: 2026, matchesPlayed: 1, matchesRemaining: 1,
      formHalfLifeDays: 365, strengthPriorMatches: 6,
      teams: [{ name: 'Arsenal FC', currentPoints: 3 }, { name: 'Chelsea FC', currentPoints: 0 }],
    })
    expect(result.data.source).toContain('OpenFootball')
    expect(result.data.teams[0].avgPoints).toBeGreaterThanOrEqual(3)
  } finally {
    provider.mockRestore()
    jest.useRealTimers()
  }
})
