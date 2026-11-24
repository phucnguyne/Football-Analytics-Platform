const { NextRequest } = require('next/server')

jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn(), getUserId: jest.fn() }))
jest.mock('@app/database/src/client', () => ({
  __esModule: true,
  default: {
    match: { findUnique: jest.fn() },
    matchComment: { findMany: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/services/match-insight.service', () => ({
  getInsightSnapshot: jest.fn(),
  loadMatchInsight: jest.fn(),
}))

const { getUserId, getCurrentUser } = require('@/lib/auth')
const prisma = require('@app/database/src/client').default
const { getInsightSnapshot, loadMatchInsight } = require('@/services/match-insight.service')
const comments = require('@/app/api/matches/[id]/comments/route')
const comment = require('@/app/api/matches/[id]/comments/[commentId]/route')
const insight = require('@/app/api/matches/[id]/insights/route')
const { pickTeamAccent } = require('@/lib/team-theme')

const match = { params: Promise.resolve({ id: '42' }) }
function request(path, method = 'GET', body) {
  return new NextRequest('http://localhost' + path, { method, body: body && JSON.stringify(body) })
}

test('anonymous users can read comments without author account identifiers', async () => {
  getCurrentUser.mockResolvedValue(null)
  prisma.match.findUnique.mockResolvedValue({ id: 42 })
  prisma.matchComment.findMany.mockResolvedValue([{
    id: 1, userId: 'protected-id', user: { username: 'Fan' }, body: '<b>Goal!</b>',
    createdAt: new Date('2026-11-23T08:00:00Z'),
  }])
  const result = await comments.GET(request('/api/matches/42/comments'), match)
  expect(await result.json()).toEqual({
    comments: [{ id: 1, author: 'Fan', body: '<b>Goal!</b>', canDelete: false, createdAt: '2026-11-23T08:00:00.000Z' }],
    nextCursor: null,
  })
  expect(result.headers.get('cache-control')).toBe('private, no-store')
})

test('comment writes require authentication and reject blank text', async () => {
  getCurrentUser.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'viewer', role: 'USER' })
  const post = () => comments.POST(request('/api/matches/42/comments', 'POST', { body: ' ' }), match)
  expect((await post()).status).toBe(401)
  expect((await post()).status).toBe(400)
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

test('normal users can delete only their own comments in the specified match', async () => {
  getCurrentUser.mockResolvedValue({ id: 'viewer', role: 'USER' })
  prisma.matchComment.deleteMany.mockResolvedValue({ count: 0 })
  expect((await comment.DELETE(request('/api/matches/42/comments/1', 'DELETE'), {
    params: Promise.resolve({ id: '42', commentId: '1' }),
  })).status).toBe(404)
  expect(prisma.matchComment.deleteMany).toHaveBeenCalledWith({ where: { id: 1, matchId: 42, userId: 'viewer' } })
})

test('insights only generate for signed-in callers and use public cached reads', async () => {
  getUserId.mockResolvedValue(null)
  getInsightSnapshot.mockResolvedValue({ kind: 'review', facts: { score: [2, 0] } })
  loadMatchInsight.mockResolvedValue({ state: 'ready', text: 'Review' })
  const path = '/api/matches/42/insights?locale=vi'
  expect((await insight.POST(request(path, 'POST'), match)).status).toBe(401)
  expect(loadMatchInsight).not.toHaveBeenCalled()
  expect((await insight.GET(request(path), match)).status).toBe(200)
  expect(loadMatchInsight).toHaveBeenCalledWith(42, 'vi', expect.anything(), false)
})

test('club colors map to accessible presets while unknown values give no preset', () => {
  expect(pickTeamAccent('White / Sky Blue')).toBe('sky')
  expect(pickTeamAccent('Claret and Blue')).toBe('claret')
  expect(pickTeamAccent('Black & White')).toBe('neutral')
  expect(pickTeamAccent('url(https://example.com)')).toBeNull()
})
