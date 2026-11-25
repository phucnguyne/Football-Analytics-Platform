jest.mock('@app/database/src/client', () => ({
  __esModule: true,
  default: { $queryRaw: jest.fn() },
}))

const prisma = require('@app/database/src/client').default
const liveness = require('@/app/api/health/route')
const readiness = require('@/app/api/health/ready/route')
const { onRequestError } = require('@/instrumentation')

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

test('liveness responds without querying the database', async () => {
  const response = await liveness.GET()
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(prisma.$queryRaw).not.toHaveBeenCalled()
})

test('readiness probes the database and prevents caching', async () => {
  prisma.$queryRaw.mockResolvedValueOnce([])
  const response = await readiness.GET()
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ status: 'ok', service: 'web', checks: { database: 'ok' } })
  expect(prisma.$queryRaw).toHaveBeenCalledWith(['SELECT 1'])
})

test('readiness reports query errors without disclosing the database error', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  prisma.$queryRaw.mockRejectedValueOnce(new Error('private connection details'))
  const response = await readiness.GET()
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({
    status: 'unavailable', service: 'web', checks: { database: 'unavailable' },
  })
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
    event: 'database_readiness_failed', reason: 'query_failed',
  })
  expect(log.mock.calls[0][0]).not.toContain('private connection details')
})

test('readiness bounds latency and shares a pending database probe', async () => {
  jest.useFakeTimers()
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  let finishQuery
  prisma.$queryRaw.mockReturnValueOnce(new Promise((resolve) => { finishQuery = resolve }))

  const responses = Promise.all([readiness.GET(), readiness.GET()])
  try {
    await jest.advanceTimersByTimeAsync(2_000)
    expect((await responses).map((response) => response.status)).toEqual([503, 503])
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ reason: 'timeout' })
  } finally {
    finishQuery([])
    await jest.advanceTimersByTimeAsync(0)
  }
  prisma.$queryRaw.mockResolvedValueOnce([])
  expect((await readiness.GET()).status).toBe(200)
  expect(prisma.$queryRaw).toHaveBeenCalledTimes(2)
})

test('request error logs contain the route pattern and omit request or error details', () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  onRequestError(
    { digest: 'error-id', message: 'private error' },
    { method: 'GET', path: '/api/matches/123?token=private', headers: { cookie: 'private' } },
    { routePath: '/api/matches/[id]', routeType: 'route' },
  )
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
    event: 'request_error', method: 'GET', route: '/api/matches/[id]', routeType: 'route', digest: 'error-id',
  })
  expect(log.mock.calls[0][0]).not.toContain('private')
})
