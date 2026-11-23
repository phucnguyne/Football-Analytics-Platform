const { NextRequest } = require('next/server')

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/env', () => ({ env: { FOOTBALL_DATA_API_URL: 'https://provider.example', FOOTBALL_DATA_API_KEY: 'fixture' } }))
jest.mock('@app/database/src/client', () => ({
  __esModule: true,
  default: { team: { findUnique: jest.fn() }, player: { findMany: jest.fn() } },
}))
jest.mock('@/lib/api-football', () => ({
  ...jest.requireActual('@/lib/api-football'),
  getApiFootballTeamSquad: jest.fn(),
}))

const prisma = require('@app/database/src/client').default
const { getApiFootballTeamSquad } = require('@/lib/api-football')
const { GET } = require('@/app/api/persons/route')

const team = { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', crest: null }
const officialPlayer = { id: 101, name: 'Martin Ødegaard', position: 'Midfielder' }
const request = (query = '') => new NextRequest('http://localhost/api/persons?teamId=57&limit=50' + query)
const originalFetch = global.fetch

beforeEach(() => {
  global.fetch = jest.fn()
  prisma.team.findUnique.mockResolvedValue(team)
  prisma.player.findMany.mockResolvedValue([])
  getApiFootballTeamSquad.mockResolvedValue([])
})
afterEach(() => { global.fetch = originalFetch })

test('team 57 serves official player IDs even when the stored roster and API-Football cannot be reconciled', async () => {
  prisma.player.findMany.mockResolvedValue([{ id: 5, name: 'Arsenal Midfielder 1' }])
  getApiFootballTeamSquad.mockResolvedValue([{ id: 1234, name: 'Another player' }])
  global.fetch.mockResolvedValue(Response.json({ ...team, squad: [officialPlayer] }))

  const response = await GET(request())
  expect(response.status).toBe(200)
  expect((await response.json()).players).toEqual([
    expect.objectContaining({ id: 101, name: 'Martin Ødegaard', team }),
  ])
  expect(global.fetch).toHaveBeenCalledTimes(1)
})

test('an unmatched search term returns an empty result without calling API-Football', async () => {
  global.fetch.mockResolvedValue(Response.json({ ...team, squad: [officialPlayer] }))
  const response = await GET(request('&query=missing'))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ players: [] })
  expect(getApiFootballTeamSquad).not.toHaveBeenCalled()
})

test('a failed provider request falls back to the local roster and skips placeholder players', async () => {
  global.fetch.mockRejectedValue(new Error('network unavailable'))
  getApiFootballTeamSquad.mockRejectedValue(new Error('network unavailable'))
  prisma.player.findMany.mockResolvedValue([officialPlayer, { id: 5, name: 'Arsenal Defender 1' }])
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect((await response.json()).players.map(({ id }) => id)).toEqual([101])
})

test('API-Football enriches the existing identity without replacing its ID', async () => {
  const player = { id: 101, name: 'Bukayo Saka', position: 'Forward' }
  global.fetch.mockResolvedValue(Response.json({ ...team, squad: [player] }))
  getApiFootballTeamSquad.mockResolvedValue([{ id: 999, name: 'B. Saka', number: 7, photo: 'fixture-photo' }])
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect((await response.json()).players[0]).toMatchObject({ id: 101, shirtNumber: 7, photo: 'fixture-photo' })
})

test('a temporary provider failure with no real fallback retains a 503', async () => {
  global.fetch.mockResolvedValue(new Response(null, { status: 429 }))
  const response = await GET(request())
  expect(response.status).toBe(503)
})
