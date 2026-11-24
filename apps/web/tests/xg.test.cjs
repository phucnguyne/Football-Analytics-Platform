const { shotFeatures, probability, teamFormFeatures } = require('../src/models/xg-features.cjs')
const { estimateShotXg, matchFormHistory } = require('../src/lib/xg-model')
const { buildFormContexts, splitCompetition } = require('../../../tools/xg-form.cjs')
const model = require('../src/models/xg-model.json')

test('the dataset includes Premier League, La Liga and senior men’s and women’s World Cups', () => {
  for (const id of [2, 11, 43, 72]) {
    expect(model.coverage.find((competition) => competition.id === id)?.trainingShots).toBeGreaterThan(0)
  }
  expect(model.training.competitions).toBe(model.coverage.length)
  expect(model.training.withForm).toBeGreaterThan(1000)
  expect(model.validation.withForm).toBeGreaterThan(100)
  expect(model.validation.model.brier).toBeLessThan(model.validation.baseline.brier)
  expect(model.validation.model.logLoss).toBeLessThan(model.validation.baseline.logLoss)
})

test('shot features reject missing coordinates and shootouts, and trained weights reward better locations', () => {
  const score = (event) => probability(shotFeatures(event), model.shotOnlyWeights)
  expect(shotFeatures({ shot: {} })).toBeNull()
  expect(shotFeatures({ period: 5, location: [110, 40], shot: {} })).toBeNull()
  const close = score({ location: [114, 40], shot: {} })
  const far = score({ location: [90, 61], shot: {} })
  expect(close).toBeGreaterThan(far)
  expect(close).toBeGreaterThan(0)
  expect(close).toBeLessThan(1)
})

test('match shots use the trained form coefficients for an identified team and use shot-only weights otherwise', () => {
  const [matchId, context] = Object.entries(model.formContexts).find(([, form]) => form[2] > 0 && form[3] > 0)
  const id = Number(matchId)
  const event = { location: [109, 36], team: { id: context[0] }, shot: {} }
  const features = shotFeatures(event)
  expect(matchFormHistory(id)).toEqual({ homeMatches: context[2], awayMatches: context[3] })
  expect(estimateShotXg(event, id)).toEqual({
    xG: probability([...features, ...context.slice(4)], model.weights),
    usesForm: true,
  })
  expect(estimateShotXg({ ...event, team: undefined }, id)).toEqual({
    xG: probability(features, model.shotOnlyWeights),
    usesForm: false,
  })
})

const fixture = (match_id, match_date, home, away, home_score = 0, away_score = 0) => ({
  match_id, match_date, home_score, away_score,
  home_team: { home_team_id: home }, away_team: { away_team_id: away },
})

test('form uses earlier recorded results without the current match or other matches on the same date', () => {
  const earlier = fixture(1, '2022-11-20', 101, 102, 2, 0)
  const first = fixture(2, '2022-11-21', 101, 103, 5, 0)
  const sameDay = fixture(3, '2022-11-21', 101, 104, 0, 5)
  const later = fixture(4, '2022-11-22', 102, 101)
  const contexts = buildFormContexts([later, sameDay, earlier, first])
  expect(contexts.get(1).slice(2, 4)).toEqual([0, 0])
  expect(contexts.get(2).slice(2, 4)).toEqual([1, 0])
  expect(contexts.get(3)).toEqual([101, 104, ...contexts.get(2).slice(2)])
  expect(contexts.get(4).slice(2, 4)).toEqual([1, 3])
  expect(teamFormFeatures(contexts.get(4), 101)).toEqual([
    ...contexts.get(4).slice(7, 10),
    ...contexts.get(4).slice(4, 7),
  ])
  expect(teamFormFeatures(contexts.get(4), 999)).toBeNull()
})

test('the chronological split keeps the holdout date entirely out of training', () => {
  const data = [
    fixture(1, '2020-01-01', 101, 102), fixture(2, '2021-01-01', 101, 102),
    fixture(3, '2022-01-01', 101, 102), fixture(4, '2022-01-01', 102, 103),
  ]
  const { train, validation } = splitCompetition(data)
  expect(train.map((match) => match.match_id)).toEqual([1, 2])
  expect(validation.map((match) => match.match_id)).toEqual([3, 4])
})
