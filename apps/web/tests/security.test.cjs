const { NextRequest } = require('next/server')
const { proxy } = require('@/proxy')
const { isSupabasePublicKey } = require('@/lib/supabase-public-key')

jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn(), getUserId: jest.fn() }))

jest.mock('@/services/season-prediction.service', () => ({
  getSeasonPrediction: jest.fn(),
}))
jest.mock('next/cache', () => ({ unstable_cache: (handler) => handler }))
jest.mock('@app/database/src/client', () => ({
  __esModule: true,
  default: { match: { count: jest.fn() }, player: { count: jest.fn() }, league: { count: jest.fn() } },
}))

const { getCurrentUser, getUserId } = require('@/lib/auth')
const { getSeasonPrediction } = require('@/services/season-prediction.service')
const prisma = require('@app/database/src/client').default
const forecast = require('@/app/api/predictions/season/route')
const stats = require('@/app/api/platform-stats/route')

const origin = 'https://app.example'
function request(path, init) {
  return new NextRequest(origin + path, init)
}

beforeEach(() => { process.env.NEXTAUTH_URL = origin })
afterAll(() => { delete process.env.NEXTAUTH_URL })

test('web proxy accepts a same-origin protected write without opening CORS', () => {
  const response = proxy(request('/api/favorites/1', { method: 'PUT', headers: { origin } }))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.has('access-control-allow-origin')).toBe(false)
})

test.each([
  { host: 'https://other.example', method: 'PUT' },
  { host: 'null', method: 'POST' },
  { host: 'https://other.example', method: 'OPTIONS' },
  { host: undefined, method: 'PUT' },
])('web proxy rejects cross-origin or originless browser writes and preflights %j', ({ host, method }) => {
  const response = proxy(request('/api/favorites/1', { method, headers: host ? { origin: host } : {} }))
  expect(response.status).toBe(403)
  expect(response.headers.get('cache-control')).toBe('no-store')
})

test('public reads and service calls reach their respective handlers without a browser origin', () => {
  expect(proxy(request('/api/matches')).status).toBe(200)
  expect(proxy(request('/api/internal/push', { method: 'POST' })).status).toBe(200)
})

test('HTML navigation gets a fresh CSP nonce for every request', () => {
  const csp = () => proxy(request('/login')).headers.get('content-security-policy')
  const first = csp()
  expect(first).toContain("frame-ancestors 'none'")
  expect(first).toMatch(/'nonce-[a-zA-Z0-9+/]+'/)
  expect(csp()).not.toBe(first)
})

test('forecast requires a session before provider calls and returns private responses', async () => {
  getUserId.mockResolvedValueOnce(null).mockResolvedValueOnce('u1')
  expect((await forecast.GET()).status).toBe(401)
  expect(getSeasonPrediction).not.toHaveBeenCalled()
  getSeasonPrediction.mockResolvedValue({ data: { season: 2026 } })
  const response = await forecast.GET()
  expect(await response.json()).toEqual({ season: 2026 })
  expect(response.headers.get('cache-control')).toBe('private, no-store')
})

test('operational stats require the currently assigned ADMIN role', async () => {
  getCurrentUser.mockResolvedValueOnce(null).mockResolvedValueOnce({ role: 'USER' }).mockResolvedValueOnce({ role: 'ADMIN' })
  expect((await stats.GET()).status).toBe(401)
  expect((await stats.GET()).status).toBe(403)
  expect(prisma.match.count).not.toHaveBeenCalled()
  const response = await stats.GET()
  expect(prisma.match.count).toHaveBeenCalledTimes(2)
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
})

test('Supabase public key validation rejects secret and service role keys', () => {
  const legacy = (role) => 'header.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature'
  expect(isSupabasePublicKey(legacy('anon'))).toBe(true)
  expect(isSupabasePublicKey('sb_publishable_example')).toBe(true)
  expect(isSupabasePublicKey(legacy('service_role'))).toBe(false)
  expect(isSupabasePublicKey('sb_secret_example')).toBe(false)
})
