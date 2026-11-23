const { NextRequest } = require('next/server')

jest.mock('@app/database/src/client', () => ({
  __esModule: true,
  default: {
    team: { findMany: jest.fn() },
    match: { findMany: jest.fn() },
    favorite: { findMany: jest.fn() },
  },
}))

jest.mock('@/services/player.service', () => ({ searchPlayers: jest.fn() }))
jest.mock('@/lib/auth', () => ({ getUserId: jest.fn() }))

const prisma = require('@app/database/src/client').default
const { searchPlayers } = require('@/services/player.service')
const { getUserId } = require('@/lib/auth')
const search = require('@/app/api/search/route')
const persons = require('@/app/api/persons/route')
const matches = require('@/app/api/matches/route')
const dashboard = require('@/app/api/dashboard/route')
const matchPrediction = require('@/app/api/predictions/matches/[matchId]/route')

function request(path, init) {
  return new NextRequest(new URL(path, 'http://localhost'), init)
}

test('global search returns bounded, grouped results with links backed by entity IDs', async () => {
  searchPlayers.mockResolvedValue({ data: { players: [{ id: 4, name: 'Player', team: { name: 'Arsenal' } }] } })
  prisma.team.findMany.mockResolvedValue([{ id: 1, name: 'Arsenal' }])
  prisma.match.findMany.mockResolvedValue([{
    id: 3,
    homeTeam: { name: 'Arsenal' },
    awayTeam: { name: 'Liverpool' },
    league: { name: 'Premier League' },
    utcDate: new Date('2026-12-01T20:00:00.000Z'),
  }])
  const response = await search.GET(request('/api/search?query=Arsenal'))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    players: [{ id: 4, name: 'Player', team: { name: 'Arsenal' } }],
    teams: [{ id: 1, name: 'Arsenal' }],
    matches: [{ id: 3, home: 'Arsenal', away: 'Liverpool', league: 'Premier League', utcDate: '2026-12-01T20:00:00.000Z' }],
  })
  expect(searchPlayers).toHaveBeenCalledWith({ query: 'Arsenal', limit: 5 })
  expect(prisma.match.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }))
})

test('search rejects a short query before reaching persistence', async () => {
  expect((await search.GET(request('/api/search?query=a'))).status).toBe(400)
  expect(searchPlayers).not.toHaveBeenCalled()
  expect(prisma.team.findMany).not.toHaveBeenCalled()
})

test('persons route trims input, limits result counts, and retains its cache policy', async () => {
  searchPlayers.mockResolvedValue({ data: { players: [] }, cache: 'short' })
  const response = await persons.GET(request('/api/persons?query=%20Son%20&limit=100'))
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toContain('s-maxage=60')
  expect(searchPlayers).toHaveBeenCalledWith({ query: 'Son', limit: 50, teamId: undefined })
})

test('matches route rejects an invalid status and serves live results without caching', async () => {
  expect((await matches.GET(request('/api/matches?status=INVALID'))).status).toBe(400)
  expect(prisma.match.findMany).not.toHaveBeenCalled()

  prisma.match.findMany.mockResolvedValue([])
  const response = await matches.GET(request('/api/matches'))
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.json()).toEqual({ matches: [] })
})

test('dashboard rejects an anonymous request before reading favorites', async () => {
  getUserId.mockResolvedValue(null)
  expect((await dashboard.GET()).status).toBe(401)
  expect(prisma.favorite.findMany).not.toHaveBeenCalled()
})

test('personal predictions reject values outside the supported choices', async () => {
  getUserId.mockResolvedValue('user-1')
  const response = await matchPrediction.PUT(request('/api/predictions/matches/1', {
    method: 'PUT',
    body: JSON.stringify({ prediction: 'NEXT_GOAL' }),
  }), { params: Promise.resolve({ matchId: '1' }) })
  expect(response.status).toBe(400)
})
