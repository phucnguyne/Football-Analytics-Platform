jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: (options) => options,
}))
jest.mock('@/lib/env', () => ({
  env: { NEXTAUTH_URL: 'https://app.example', NEXTAUTH_SECRET: 'test-only' },
}))
jest.mock('@/lib/login-rate-limit', () => ({
  reserveLoginAttempt: jest.fn(),
  resetLoginAttempts: jest.fn(),
}))
jest.mock('bcryptjs', () => ({ compare: jest.fn() }))
jest.mock('@app/database', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    session: { findUnique: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}), { virtual: true })

const bcrypt = require('bcryptjs')
const { prisma } = require('@app/database')
const { authOptions } = require('@/lib/auth')
const { reserveLoginAttempt, resetLoginAttempts } = require('@/lib/login-rate-limit')

const authorize = authOptions.providers[0].authorize
const credentials = { email: 'player@example.com', password: 'test password' }

test('unknown email and incorrect password both fail without skipping bcrypt', async () => {
  reserveLoginAttempt.mockResolvedValue({ key: 'email' })
  prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ password: 'stored-hash' })
  bcrypt.compare.mockResolvedValue(false)

  expect(await authorize(credentials, {})).toBeNull()
  expect(await authorize(credentials, {})).toBeNull()
  expect(bcrypt.compare).toHaveBeenCalledTimes(2)
  expect(resetLoginAttempts).not.toHaveBeenCalled()
})

test('locked credentials fail before account lookup or bcrypt', async () => {
  reserveLoginAttempt.mockResolvedValue(null)
  expect(await authorize(credentials, {})).toBeNull()
  expect(prisma.user.findUnique).not.toHaveBeenCalled()
  expect(bcrypt.compare).not.toHaveBeenCalled()
})

test('HTTPS sign-in persists a hashed session ID and revokes it on sign-out', async () => {
  expect(authOptions.useSecureCookies).toBe(true)
  expect(authOptions.session.maxAge).toBe(8 * 60 * 60)
  const token = await authOptions.callbacks.jwt({ token: {}, user: { id: 'id-1' } })
  const record = prisma.session.create.mock.calls[0][0].data
  expect(record.sessionToken).toMatch(/^[a-f0-9]{64}$/)
  expect(record.sessionToken).not.toBe(token.sid)
  expect(record.expires.getTime() - Date.now()).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)

  await authOptions.events.signOut({ token })
  expect(prisma.session.deleteMany).toHaveBeenLastCalledWith({
    where: { userId: 'id-1', sessionToken: record.sessionToken },
  })
})

test('revoked, expired and legacy tokens cannot produce a valid session', async () => {
  await expect(authOptions.callbacks.jwt({ token: { sub: 'id-1' } })).rejects.toThrow()
  prisma.session.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
    user: { id: 'id-1' }, expires: new Date(0),
  })
  for (let i = 0; i < 2; i++) {
    await expect(authOptions.callbacks.jwt({ token: { sub: 'id-1', sid: 'session-id' } })).rejects.toThrow()
  }
})
