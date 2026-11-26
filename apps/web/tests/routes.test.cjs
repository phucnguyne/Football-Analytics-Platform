const { NextRequest } = require('next/server')

jest.mock('@app/database/src/client', () => ({
  __esModule: true,
  default: {
    player: { findUnique: jest.fn() },
    playerSeasonSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
    playerMatchStat: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    playerPitchPoint: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    team: { findMany: jest.fn(), findUnique: jest.fn() },
    match: { findMany: jest.fn() },
    favorite: { findMany: jest.fn() },
  },
}))

jest.mock('@/services/player.service', () => ({ searchPlayers: jest.fn() }))
jest.mock('@/lib/auth', () => ({ getUserId: jest.fn() }))
jest.mock('@/lib/env', () => ({ env: {} }))
jest.mock('@/lib/api-football', () => ({
  apiFootballSeasonYear: jest.fn(() => 2026),
  getPlayerSeasonMetricsForTeam: jest.fn(),
  getFixturePlayerPerformance: jest.fn(),
  resolveApiFootballFixtureId: jest.fn(),
  resolveApiFootballPlayerId: jest.fn(),
  getPlayerCareerTeams: jest.fn(),
}))
jest.mock('@/lib/statsbomb', () => ({ readStatsBombEvents: jest.fn() }))

const prisma = require('@app/database/src/client').default
const { searchPlayers } = require('@/services/player.service')
const { getUserId } = require('@/lib/auth')
const search = require('@/app/api/search/route')
const persons = require('@/app/api/persons/route')
const compare = require('@/app/api/persons/compare/route')
const matches = require('@/app/api/matches/route')
const dashboard = require('@/app/api/dashboard/route')
const matchPrediction = require('@/app/api/predictions/matches/[matchId]/route')
const form = require('@/app/api/persons/[playerId]/form/route')
const profile = require('@/app/api/persons/[playerId]/route')
const similar = require('@/app/api/persons/[playerId]/similar/route')
const heatmap = require('@/app/api/persons/[playerId]/heatmap/route')
const career = require('@/app/api/persons/[playerId]/career/route')
const apiFootball = require('@/lib/api-football')

function request(path, init) {
  return new NextRequest(new URL(path, 'http://localhost'), init)
}

test('player profile and similarities use the imported historical season and a same-position cohort', async () => {
  const target = { id: 1, name: 'Verified Player', position: 'FORWARD' }
  const peers = [
    { player: target, team: { id: 10, name: 'Prior Club' }, metrics: { minutesPlayed: 900, shotsPer90: 2, tacklesPer90: 1, interceptions: 0.5 } },
    { player: { id: 2, name: 'Peer', position: 'FORWARD' }, team: { id: 20 }, metrics: { minutesPlayed: 900, shotsPer90: 3, tacklesPer90: 1, interceptions: 0.4 } },
    { player: { id: 3, name: 'Limited Minutes', position: 'FORWARD' }, team: { id: 30 }, metrics: { minutesPlayed: 20, shotsPer90: 4, tacklesPer90: 2, interceptions: 1 } },
  ]
  const snapshot = { season: { year: 2024 }, seasonId: 8, teamId: 10, metrics: peers[0].metrics }
  prisma.player.findUnique
    .mockResolvedValueOnce({ ...target, teams: [{ to: null, team: { id: 30 } }], stats: null })
    .mockResolvedValueOnce({ ...target, teams: [{ teamId: 30 }], stats: null })
  prisma.playerSeasonSnapshot.findMany.mockResolvedValueOnce([snapshot]).mockResolvedValueOnce(peers)
    .mockResolvedValueOnce([snapshot]).mockResolvedValueOnce(peers)
  const context = { params: Promise.resolve({ playerId: '1' }) }

  const result = await profile.GET(request('/api/persons/1'), context)
  expect(await result.json()).toMatchObject({
    statsSource: 'api-football', statsSeason: 2024, statsTeam: 'Prior Club',
    stats: { minutesPlayed: 900, dataSource: 'REAL' },
    positionalAverages: { shotsPer90: 3, xG: null },
  })
  const comparison = await similar.GET(request('/api/persons/1/similar'), context)
  expect(await comparison.json()).toMatchObject({
    statsSeason: 2024, statsSource: 'api-football', similarPlayers: [{ id: 2 }],
  })
  expect(prisma.playerSeasonSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { seasonId: 8, player: { position: 'FORWARD' } },
  }))
  expect(apiFootball.getPlayerSeasonMetricsForTeam).not.toHaveBeenCalled()
})

test('latest saved form is returned without provider calls and retains its source and match side', async () => {
  prisma.player.findUnique.mockResolvedValueOnce({ name: 'Verified Player', teams: [] })
  prisma.playerMatchStat.findMany.mockResolvedValueOnce([{
    source: 'HIGHLIGHTLY', teamId: 2, minutes: 71, rating: 7.2, goals: 0, assists: 1, xG: null, xA: 0.5, keyPasses: 3, tackles: 2,
    match: {
      id: 8, utcDate: new Date('2026-11-02T19:00Z'),
      homeTeam: { id: 1, name: 'Home' }, awayTeam: { id: 2, name: 'Away' },
      score: { winner: 'AWAY', homeTeamGoals: 0, awayTeamGoals: 1 },
    },
  }])
  const result = await form.GET(request('/api/persons/1/form'), { params: Promise.resolve({ playerId: '1' }) })
  expect(await result.json()).toMatchObject({
    source: 'highlightly', matches: [{ isHome: false, result: 'W', minutes: 71, xG: null, xA: 0.5 }],
  })
  expect(apiFootball.getFixturePlayerPerformance).not.toHaveBeenCalled()
})

test('player shot map keeps source and coverage distinct from action events', async () => {
  prisma.playerPitchPoint.findFirst.mockResolvedValueOnce({ season: 2026 })
  prisma.playerPitchPoint.findMany.mockResolvedValueOnce([
    { x: 84, y: 60, xG: 0.2, externalMatchId: '10' },
    { x: 90, y: 40, xG: null, externalMatchId: '10' },
  ])
  const result = await heatmap.GET(request('/api/persons/1/heatmap?view=shots'), { params: Promise.resolve({ playerId: '1' }) })
  expect(await result.json()).toMatchObject({
    source: 'understat-shots', available: true, season: 2026, matchCount: 1,
    points: [{ x: 84, y: 60, xG: 0.2 }, { x: 90, y: 40, xG: null }],
  })
  expect(prisma.playerPitchPoint.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { playerId: 1, source: 'UNDERSTAT_SHOTS' },
  }))
})

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

test('player comparison keeps database errors in the server log', async () => {
  const error = new Error('The column player_stats.dataSource does not exist')
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  prisma.player.findUnique.mockRejectedValue(error)
  try {
    const response = await compare.GET(request('/api/persons/compare?p1=1&p2=2'))
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Unable to compare players' })
    expect(log).toHaveBeenCalledWith('Error comparing players:', error)
  } finally {
    log.mockRestore()
  }
})

test('comparison requests the selected clubs for the same season and withholds unverified fallback stats', async () => {
  prisma.player.findUnique
    .mockResolvedValueOnce({ id: 1, name: 'First', teams: [], stats: { dataSource: null, goals: 12 } })
    .mockResolvedValueOnce({ id: 2, name: 'Second', teams: [], stats: { dataSource: null, goals: 9 } })
  prisma.team.findUnique
    .mockResolvedValueOnce({ id: 10, name: 'Club A' })
    .mockResolvedValueOnce({ id: 20, name: 'Club B' })
  apiFootball.getPlayerSeasonMetricsForTeam.mockResolvedValue(null)

  const response = await compare.GET(request('/api/persons/compare?p1=1&p2=2&p1TeamId=10&p2TeamId=20'))
  expect(apiFootball.getPlayerSeasonMetricsForTeam).toHaveBeenCalledWith('First', 'Club A', 2026)
  expect(apiFootball.getPlayerSeasonMetricsForTeam).toHaveBeenCalledWith('Second', 'Club B', 2026)
  expect(await response.json()).toMatchObject({
    player1: { team: { id: 10 }, stats: null },
    player2: { team: { id: 20 }, stats: null },
    statsProvenance: 'unavailable',
  })
})

test('comparison uses the latest shared recorded season without calling a provider', async () => {
  prisma.player.findUnique
    .mockResolvedValueOnce({ id: 1, name: 'First', teams: [{ team: { id: 10, name: 'Club A' } }], stats: null })
    .mockResolvedValueOnce({ id: 2, name: 'Second', teams: [{ team: { id: 20, name: 'Club B' } }], stats: null })
  prisma.playerSeasonSnapshot.findMany.mockResolvedValueOnce([
    { playerId: 1, seasonId: 8, season: { year: 2025 }, metrics: { matchesPlayed: 24 } },
    { playerId: 1, seasonId: 7, season: { year: 2024 }, metrics: { matchesPlayed: 22 } },
    { playerId: 2, seasonId: 7, season: { year: 2024 }, metrics: { matchesPlayed: 28 } },
  ])
  const response = await compare.GET(request('/api/persons/compare?p1=1&p2=2&p1TeamId=10&p2TeamId=20'))
  expect(apiFootball.getPlayerSeasonMetricsForTeam).not.toHaveBeenCalled()
  expect(prisma.team.findUnique).not.toHaveBeenCalled()
  expect(await response.json()).toMatchObject({
    statsSeason: 2024, statsSource: 'API-Football',
    player1: { stats: { matchesPlayed: 22 } },
    player2: { stats: { matchesPlayed: 28 } },
  })
})

test('matches route rejects an invalid status and serves live results without caching', async () => {
  expect((await matches.GET(request('/api/matches?status=INVALID'))).status).toBe(400)
  expect(prisma.match.findMany).not.toHaveBeenCalled()

  prisma.match.findMany.mockResolvedValue([])
  const response = await matches.GET(request('/api/matches'))
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.json()).toEqual({ matches: [] })
})

test('live feed can include only recent finished fixtures that have scores', async () => {
  prisma.match.findMany.mockResolvedValue([])
  await matches.GET(request('/api/matches?status=IN_PLAY,PAUSED&recentResults=true'))
  expect(prisma.match.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { OR: [
      { status: { in: ['IN_PLAY', 'PAUSED'] } },
      { status: 'FINISHED', utcDate: { gte: expect.any(Date) }, score: { isNot: null } },
    ] },
  }))
})

test('player form uses the match score and real away-team appearance', async () => {
  prisma.player.findUnique.mockResolvedValue({ name: 'Player', teams: [{ teamId: 2 }] })
  prisma.match.findMany.mockResolvedValue([{
    id: 8, utcDate: new Date('2026-11-02T19:00Z'),
    homeTeam: { id: 1, name: 'Home', shortName: 'Home' },
    awayTeam: { id: 2, name: 'Away', shortName: 'Away' },
    score: { homeTeamGoals: 1, awayTeamGoals: 3, winner: 'AWAY' },
    lineups: [],
  }])
  apiFootball.resolveApiFootballPlayerId.mockResolvedValue(9)
  apiFootball.resolveApiFootballFixtureId.mockResolvedValue(17)
  apiFootball.getFixturePlayerPerformance.mockResolvedValue({
    isHome: false, minutes: 71, rating: 7.1, goals: 1, assists: null, keyPasses: null, tackles: null,
  })
  const response = await form.GET(request('/api/persons/3/form'), { params: Promise.resolve({ playerId: '3' }) })
  expect(await response.json()).toMatchObject({
    source: 'api-football',
    matches: [{ result: 'W', isHome: false, opponent: { id: 1 }, score: '1 - 3', minutes: 71, goals: 1, xG: null, xA: null }],
    summary: { totalAssistsLast5: null },
  })
})

test('player career does not use unverified stats or invent a timeline on database failure', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  const getCareer = () => career.GET(request('/api/persons/3/career'), { params: Promise.resolve({ playerId: '3' }) })
  try {
    prisma.player.findUnique.mockResolvedValue({
      name: 'Player',
      teams: [{ from: null, to: null, team: { id: 2, name: 'Real Club' } }],
      stats: { dataSource: null, goals: 10 },
    })
    apiFootball.resolveApiFootballPlayerId.mockResolvedValue(null)
    expect(await (await getCareer()).json()).toEqual({
      clubs: [{ id: 2, name: 'Real Club', from: null, to: null, seasons: [], source: 'database' }],
      seasonStats: null,
    })
    prisma.player.findUnique.mockRejectedValue(new Error('offline'))
    expect((await getCareer()).status).toBe(503)
  } finally {
    log.mockRestore()
  }
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
