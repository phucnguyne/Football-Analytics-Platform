const { readdirSync, readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { openapi } = require('@/lib/openapi')

test('every explicit App Router API operation is present in OpenAPI', () => {
  const dir = resolve(__dirname, '../src/app/api')
  const files = readdirSync(dir, { recursive: true }).filter((file) => file.endsWith('route.ts'))
  for (const file of files) {
    const contents = readFileSync(resolve(dir, file), 'utf8')
    const methods = [...contents.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b|\bas (GET|POST|PUT|PATCH|DELETE)\b/g)]
      .map((match) => (match[1] ?? match[2]).toLowerCase())
    const path = '/api/' + file.replace(/\/route.ts$/, '').replace(/\[([^\]]+)\]/g, '{$1}')
    for (const method of methods) {
      const target = file.startsWith('auth/') ? (method === 'get' ? '/api/auth/session' : '/api/auth/callback/credentials') : path
      expect(openapi.paths[target]?.[method]?.operationId).toBeDefined()
    }
  }
})

test('security and request contracts describe comments, predictions and legacy writes', () => {
  expect(openapi.paths['/api/matches/{id}/comments'].post.security).toEqual([{ sessionCookie: [] }])
  expect(openapi.paths['/api/predictions/matches/{matchId}'].put.requestBody.required).toBe(true)
  expect(openapi.paths['/api/live-scores/{id}'].patch.security).toEqual([{ scoreWriter: [] }])
})
