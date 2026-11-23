const { toCsv } = require('@/lib/data-export')
const { dataSourceFor } = require('@/lib/data-source')
const { escapeSearchTerm, splitFixtureQuery } = require('@/lib/search')
const { computeMatchProbabilities, poisson } = require('@/lib/poisson')
const { parseSeasonIdentifier, getSeasonFilter } = require('@/lib/competition-seasons')
const { endpointSchema, subscriptionSchema } = require('@/lib/push-subscription')

test('quotes CSV text, preserves signed numbers, and neutralizes formulas', () => {
  expect(toCsv(['Đội', 'Điểm'], [['Arsenal, "FC"', -3], ['  =2+2', null]]))
    .toBe('"Đội","Điểm"\r\n"Arsenal, ""FC""","-3"\r\n"\'  =2+2",""')
})

test.each([
  [[], 'unavailable'],
  [['REAL', undefined], 'unavailable'],
  [['REAL'], 'real'],
  [['GENERATED', 'GENERATED'], 'generated'],
  [['REAL', 'GENERATED'], 'mixed'],
])('classifies source inputs %j as %s', (sources, expected) => {
  expect(dataSourceFor(sources)).toBe(expected)
})

test('uses literal substring searches and parses two-team queries', () => {
  expect(escapeSearchTerm('50%_\\')).toBe('50\\%\\_\\\\')
  expect(splitFixtureQuery('Manchester City VS. Liverpool')).toEqual(['Manchester City', 'Liverpool'])
  expect(splitFixtureQuery('Paris Saint-Germain')).toBeNull()
})

test('builds symmetric Poisson outcomes for equal-scoring teams', () => {
  expect(poisson(0, 0)).toBe(1)
  const prediction = computeMatchProbabilities(1.5, 1.5)
  expect(prediction.homeWin).toBeCloseTo(prediction.awayWin)
  expect(prediction.homeWin + prediction.draw + prediction.awayWin).toBeCloseTo(100, 0)
})

test('keeps database season IDs distinct from season years', () => {
  expect(parseSeasonIdentifier('invalid')).toBeUndefined()
  expect(getSeasonFilter(parseSeasonIdentifier('17'))).toEqual({ id: 17 })
  expect(getSeasonFilter(parseSeasonIdentifier('2025'))).toEqual({ year: 2025 })
})

test('accepts supported browser push endpoints and rejects other destinations', () => {
  expect(endpointSchema.safeParse('https://fcm.googleapis.com/fcm/send/subscription').success).toBe(true)
  for (const endpoint of [
    'http://fcm.googleapis.com/fcm/send/subscription',
    'https://fcm.googleapis.com:8080/fcm/send/subscription',
    'https://example.com',
    'https://fcm.googleapis.com.example.com',
  ]) {
    expect(endpointSchema.safeParse(endpoint).success).toBe(false)
  }
  expect(subscriptionSchema.safeParse({
    endpoint: 'https://web.push.apple.com/token',
    keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) },
    locale: 'vi',
  }).success).toBe(true)
})

test('the English and Vietnamese catalogs expose the same message keys', () => {
  const en = require('../messages/en.json')
  const vi = require('../messages/vi.json')
  const keys = (catalog) => Object.entries(catalog)
    .flatMap(([namespace, entries]) => Object.keys(entries).map((key) => namespace + '.' + key))
    .sort()
  expect(keys(vi)).toEqual(keys(en))
})
