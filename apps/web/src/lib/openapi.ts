type Access = 'public' | 'session' | 'admin' | 'push' | 'writer' | 'internal' | 'edgeSync'
type Schema = Record<string, unknown>
type Parameter = { name: string; in: 'path' | 'query'; required?: boolean; description?: string; schema: Schema }
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

const text = { type: 'string' }
const integer = { type: 'integer' }
const id = { type: 'integer', minimum: 1, maximum: 2147483647 }
const dateTime = { type: 'string', format: 'date-time' }
const generic = { type: 'object', additionalProperties: true }
const prediction = { type: 'string', enum: ['HOME_WIN', 'DRAW', 'AWAY_WIN'] }
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const list = (items: Schema) => ({ type: 'array', items })
const object = (properties: Record<string, Schema>, required = Object.keys(properties)) => ({
  type: 'object', properties, required,
})
const nullable = (schema: Schema) => ({ anyOf: [schema, { type: 'null' }] })
const json = (schema: Schema) => ({ 'application/json': { schema } })
const query = (name: string, schema: Schema, description: string, required = false): Parameter => ({
  name, in: 'query', required, schema, description,
})
const season = query('seasonId', id, 'Season ID or four-digit start year')
const teamId = query('teamId', id, 'Restrict results to a team')
const status = query('status', text, 'Comma-separated match statuses')
const search = query('query', text, 'Text to search')
const localFastify = { url: 'http://localhost:3002', description: 'Self-hosted Fastify service' }
const localRealtime = { url: 'http://localhost:3001', description: 'Self-hosted realtime service' }
const origin = {
  name: 'Origin', in: 'header', required: true,
  description: 'Exact website origin for a same-origin browser write',
  schema: text,
}

const auth = {
  session: { sessionCookie: [] }, admin: { sessionCookie: [] }, push: { pushSecret: [] },
  writer: { scoreWriter: [] }, internal: { internalSecret: [] }, edgeSync: { syncSecret: [] },
}
const errors: Record<number, string> = {
  400: 'Invalid request', 401: 'Authentication required', 403: 'Access denied',
  404: 'Resource not found', 409: 'The prediction window has closed', 429: 'Rate limit exceeded',
  500: 'Server error', 502: 'Upstream provider failure', 503: 'Service or data unavailable',
}

const paths: Record<string, Record<string, unknown>> = {}
function add(path: string, method: Method, summary: string, options: {
  tag?: string
  access?: Access
  params?: Parameter[]
  body?: Schema
  form?: boolean
  schema?: Schema
  media?: string
  success?: 200 | 201 | 204 | 302
  extraResponses?: Record<number, unknown>
  failures?: number[]
  servers?: { url: string; description?: string; variables?: Record<string, { default: string }> }[]
  description?: string
} = {}) {
  const access = options.access ?? 'public'
  const code = options.success ?? 200
  const params = Array.from(path.matchAll(/\{([^}]+)\}/g), ([, name]) => ({
    name, in: 'path', required: true,
    schema: name === 'competition' || name === 'asset' || name === 'action' ? text : id,
  }))
  const statusCodes = new Set([...(options.failures ?? []), ...(access === 'public' ? [] : [401]), ...(access === 'admin' ? [403] : [])])
  const needsOrigin = method !== 'get' && path.startsWith('/api/') && !options.servers &&
    access !== 'push'
  const contentType = options.form ? 'application/x-www-form-urlencoded' : 'application/json'
  const success = code === 204 || code === 302 ? { description: code === 204 ? 'No content' : 'Redirect' }
    : { description: 'Success', content: { [options.media ?? 'application/json']: { schema: options.schema ?? generic } } }

  paths[path] ??= {}
  paths[path][method] = {
    summary,
    tags: [options.tag ?? 'System'],
    operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    description: options.description,
    ...(options.servers ? { servers: options.servers } : {}),
    parameters: [...params, ...(options.params ?? []), ...(needsOrigin ? [origin] : [])],
    security: access === 'public' ? [] : [auth[access]],
    ...(options.body ? { requestBody: { required: true, content: { [contentType]: { schema: options.body } } } } : {}),
    responses: {
      [code]: success,
      ...(options.extraResponses ?? {}),
      ...Object.fromEntries([...statusCodes].map((statusCode) => [
        statusCode, { description: errors[statusCode] ?? 'Request failed', content: json(ref('Error')) },
      ])),
    },
  }
}

const listMatches = object({ matches: list(ref('Match')) })
const playerList = object({ players: list(ref('Player')) })
const teamList = object({ teams: list(ref('Team')) })

add('/api/health', 'get', 'Web service liveness', { schema: object({ status: text, service: text, timestamp: dateTime }) })
add('/api/search', 'get', 'Search players, clubs and fixtures', {
  params: [query('query', { ...text, minLength: 2, maxLength: 80 }, 'Search term', true)], failures: [400, 500],
  schema: object({ players: list(ref('Player')), teams: list(ref('Team')), matches: list(generic) }),
})
add('/api/platform-stats', 'get', 'Platform totals', {
  access: 'admin', schema: object({ matchCount: integer, playerCount: integer, finishedCount: integer, leagueCount: integer }),
})
add('/api/dashboard', 'get', 'Personal dashboard', {
  access: 'session', schema: object({
    teams: list(ref('Team')), fixtures: list(ref('Match')), predictions: list(generic), pushPublicKey: nullable(text),
  }),
})
add('/api/openapi', 'get', 'OpenAPI document')
add('/api/docs', 'get', 'Swagger UI', { media: 'text/html', schema: text })
add('/api/docs/{asset}', 'get', 'Swagger UI static assets', { media: 'application/octet-stream', schema: text, failures: [404] })

add('/api/matches', 'get', 'Live matches and matches by status', { tag: 'Matches', params: [status], schema: listMatches, failures: [400, 500] })
add('/api/matches/{id}', 'get', 'Match details', { tag: 'Matches', schema: ref('Match'), failures: [400, 404, 500] })
add('/api/matches/{id}/stats', 'get', 'Match statistics and momentum', { tag: 'Matches', failures: [400, 404, 500] })
add('/api/matches/{id}/tactics', 'get', 'Tactical metrics and confirmed lineups', { tag: 'Matches', failures: [400, 404, 500] })
add('/api/matches/{id}/provider-events', 'get', 'Events from API-Football when available', {
  tag: 'Matches', schema: object({ available: { type: 'boolean' }, events: list(generic) }, ['available', 'events']), failures: [400, 404],
})
add('/api/matches/{id}/shots', 'get', 'StatsBomb shot map and trained xG', {
  tag: 'Matches', schema: object({ available: { type: 'boolean' }, shots: list(ref('Shot')), source: text, matchId: id, xgModel: nullable(generic), form: nullable(object({ homeMatches: integer, awayMatches: integer })) }),
  failures: [400],
})
add('/api/matches/{id}/comments', 'get', 'Browse match comments', {
  tag: 'Social', params: [query('before', id, 'Pagination cursor from the preceding page')], failures: [400, 404],
  schema: object({ comments: list(ref('Comment')), nextCursor: nullable(id) }),
})
add('/api/matches/{id}/comments', 'post', 'Post a match comment', {
  tag: 'Social', access: 'session', body: object({ body: { ...text, minLength: 1, maxLength: 1000 } }),
  success: 201, schema: object({ id }), failures: [400, 404, 429],
})
add('/api/matches/{id}/comments/{commentId}', 'delete', 'Delete a comment as its author or an administrator', {
  tag: 'Social', access: 'session', success: 204, failures: [400, 404],
})
for (const method of ['get', 'post'] as const) {
  add('/api/matches/{id}/insights', method, method === 'get' ? 'Read a cached AI match insight' : 'Generate a match insight if missing', {
    tag: 'Matches', access: method === 'post' ? 'session' : 'public',
    params: [query('locale', { ...text, enum: ['en', 'vi'], default: 'en' }, 'Language of the insight')],
    schema: { oneOf: [
      object({ state: { const: 'ready' }, kind: { enum: ['preview', 'review'] }, text, model: nullable(text), generatedAt: nullable(dateTime) }),
      object({ state: { enum: ['missing', 'pending', 'disabled', 'unavailable'] } }),
    ] }, failures: [400, 404],
  })
}

for (const [segment, summary, field, schema] of [
  ['matches', 'Competition fixtures', 'matches', ref('Match')],
  ['teams', 'Competition teams', 'teams', ref('Team')],
  ['standings', 'Competition standings', 'standings', generic],
  ['seasons', 'Available seasons', 'seasons', object({ id, year: integer, isCurrent: { type: 'boolean' } })],
] as const) {
  add(`/api/competitions/{competition}/${segment}`, 'get', summary, {
    tag: 'Competitions', params: segment === 'seasons' ? [] : [season],
    schema: object({ [field]: list(schema) }), failures: [400, 404, 500],
  })
}

add('/api/teams/{teamId}', 'get', 'Team profile including squad and club colors', { tag: 'Teams', schema: ref('Team'), failures: [400, 404, 500] })
add('/api/teams/{teamId}/matches', 'get', 'Team match history', {
  tag: 'Teams', params: [status, query('limit', integer, 'Maximum number of matches')], schema: listMatches, failures: [400, 500],
})
add('/api/teams/{teamId}/scouting', 'get', 'Team scouting report with source labels', { tag: 'Teams', failures: [400, 404] })
for (const [method, summary] of [['get', 'Check followed-team status'], ['put', 'Follow a team'], ['delete', 'Unfollow a team']] as const) {
  add('/api/favorites/{teamId}', method, summary, {
    tag: 'Teams', access: 'session', schema: object({ favorite: { type: 'boolean' } }), failures: [400, 404],
  })
}

add('/api/persons', 'get', 'Player directory or team squad', {
  tag: 'Players', params: [search, teamId, query('limit', { ...integer, minimum: 1, maximum: 50, default: 25 }, 'Maximum number of players')],
  schema: playerList, failures: [400, 404, 500, 503],
})
add('/api/persons/{playerId}', 'get', 'Player profile and statistics', { tag: 'Players', schema: ref('Player'), failures: [400, 404, 500] })
for (const [subpath, summary] of [
  ['career', 'Career timeline and source labels'], ['form', 'Recent player form'], ['heatmap', 'Player heatmap'],
  ['similar', 'Similar player profiles'],
]) add(`/api/persons/{playerId}/${subpath}`, 'get', summary, { tag: 'Players', failures: [400, 404, 500] })
add('/api/persons/{playerId}/photo', 'get', 'Redirect to a player photo or return a placeholder', {
  tag: 'Players', media: 'image/svg+xml', schema: text, params: [query('name', text, 'Player name', true)], failures: [400],
  extraResponses: { 307: { description: 'Redirect to a Wikimedia photo' } },
})
add('/api/persons/compare', 'get', 'Compare two players', {
  tag: 'Players', params: [
    query('p1', id, 'First player ID', true), query('p2', id, 'Second player ID', true),
    query('p1TeamId', id, 'First player team context'), query('p2TeamId', id, 'Second player team context'),
  ], failures: [400, 404, 502],
})

add('/api/predictions/season', 'get', 'Season predictions', { tag: 'Predictions', access: 'session', failures: [400, 502, 503] })
add('/api/predictions/matches/{matchId}', 'get', 'Read a personal match prediction', {
  tag: 'Predictions', access: 'session', schema: object({ prediction: nullable(prediction) }), failures: [400],
})
add('/api/predictions/matches/{matchId}', 'put', 'Save a match prediction before kickoff', {
  tag: 'Predictions', access: 'session', body: object({ prediction }), schema: object({ prediction }), failures: [400, 409],
})

const endpoint = { ...text, format: 'uri', maxLength: 2048 }
for (const [method, summary] of [
  ['post', 'Check a browser push subscription'], ['put', 'Register a browser push subscription'],
  ['delete', 'Remove a browser push subscription'],
] as const) {
  add('/api/push/subscription', method, summary, {
    tag: 'Notifications', access: 'session', failures: [400],
    body: method === 'put' ? object({ endpoint, keys: object({ p256dh: text, auth: text }), locale: { enum: ['en', 'vi'] } }) : object({ endpoint }),
    schema: object({ enabled: { type: 'boolean' } }),
  })
}
add('/api/internal/push', 'post', 'Dispatch queued push alerts as the live-sync worker', {
  tag: 'Notifications', access: 'push', schema: object({ sent: integer }),
})

const csrfFields = { csrfToken: text, callbackUrl: text }
add('/api/auth/providers', 'get', 'Available sign-in providers', { tag: 'Authentication' })
add('/api/auth/csrf', 'get', 'Read CSRF token for authentication requests', { tag: 'Authentication', schema: object({ csrfToken: text }) })
add('/api/auth/session', 'get', 'Read the current session and refresh the signed-in cookie', { tag: 'Authentication' })
add('/api/auth/session', 'post', 'Refresh the session using NextAuth’s client protocol', {
  tag: 'Authentication', body: object({ csrfToken: text, data: generic }, ['csrfToken']),
})
add('/api/auth/callback/credentials', 'post', 'Sign in with email and password', {
  tag: 'Authentication', form: true, body: object({ ...csrfFields, email: text, password: text }, ['csrfToken', 'email', 'password']),
  success: 302, failures: [401],
})
add('/api/auth/signout', 'post', 'Revoke the current session and clear its cookie', {
  tag: 'Authentication', form: true, body: object(csrfFields, ['csrfToken']), success: 302,
})
for (const action of ['signin', 'signout', 'error', 'verify-request']) {
  add(`/api/auth/${action}`, 'get', `NextAuth ${action} page or redirect`, { tag: 'Authentication', media: 'text/html', schema: text })
}

const scoreFields = {
  homeTeamGoals: { ...integer, minimum: 0 }, awayTeamGoals: { ...integer, minimum: 0 },
  homeTeamGoalsHT: { ...integer, minimum: 0 }, awayTeamGoalsHT: { ...integer, minimum: 0 }, minute: integer,
}
for (const route of ['/api/live-scores', '/api/live-scores/{id}']) {
  add(route, 'get', 'Read scores from the self-hosted service', { tag: 'Self-hosted', servers: [localFastify], failures: [400, 404] })
}
for (const route of ['/api/live-scores/{id}', '/api/live-scores/{id}/finish']) {
  add(route, 'patch', 'Update a score as a trusted service', {
    tag: 'Self-hosted', servers: [localFastify], access: 'writer', failures: [400, 404],
    ...(route.endsWith('/finish') ? {} : { body: object(scoreFields, ['homeTeamGoals', 'awayTeamGoals']) }),
  })
}
add('/internal/emit', 'post', 'Broadcast a validated score update from a trusted service', {
  tag: 'Self-hosted', servers: [localRealtime], access: 'internal', failures: [400],
  body: object({ event: { const: 'score:updated' }, data: object({
    matchId: { oneOf: [id, text] }, homeScore: integer, awayScore: integer,
    status: { enum: ['SCHEDULED', 'LIVE', 'HT', 'FT'] }, minute: nullable(integer),
    homeTeam: text, awayTeam: text, updatedAt: dateTime,
  }, ['matchId', 'homeScore', 'awayScore', 'status']) }),
})
add('/functions/v1/sync-live', 'post', 'Sync scores from the data provider and trigger push dispatch', {
  tag: 'Edge Functions', access: 'edgeSync', failures: [500],
  servers: [{ url: 'https://{projectRef}.supabase.co', variables: { projectRef: { default: 'your-project' } } }],
  schema: object({ ok: { type: 'boolean' }, processed: integer, changed: integer, date: { type: 'string', format: 'date' } }, ['ok', 'processed']),
})
add('/health', 'get', 'Self-hosted service liveness', { tag: 'Self-hosted', servers: [localFastify, localRealtime], failures: [503] })

export const openapi = {
  openapi: '3.1.0',
  info: { title: 'Football Analytics Pro API', version: '1.0.0', description: 'Web API and self-hosted HTTP endpoints. Authenticated web requests use the same-origin session cookie.' },
  servers: [{ url: '/' }],
  paths,
  components: {
    securitySchemes: {
      sessionCookie: { type: 'apiKey', in: 'cookie', name: '__Secure-next-auth.session-token', description: 'NextAuth session cookie. Local HTTP uses next-auth.session-token.' },
      pushSecret: { type: 'apiKey', in: 'header', name: 'x-push-secret' },
      scoreWriter: { type: 'http', scheme: 'bearer' },
      internalSecret: { type: 'apiKey', in: 'header', name: 'x-internal-secret' },
      syncSecret: { type: 'apiKey', in: 'header', name: 'x-sync-secret' },
    },
    schemas: {
      Error: object({ error: text }),
      Match: { ...object({ id, status: text, utcDate: dateTime, homeTeam: ref('Team'), awayTeam: ref('Team') }, ['id']), additionalProperties: true },
      Team: { ...object({ id, name: text, shortName: nullable(text), crest: nullable(text), clubColors: nullable(text) }, ['id', 'name']), additionalProperties: true },
      Player: { ...object({ id, name: text, position: nullable(text), photo: nullable(text), team: nullable(ref('Team')) }, ['id', 'name']), additionalProperties: true },
      Comment: object({ id, body: text, createdAt: dateTime, author: nullable(text), canDelete: { type: 'boolean' } }),
      Shot: { ...object({ x: { type: 'number' }, y: { type: 'number' }, xG: nullable({ type: 'number', minimum: 0, maximum: 1 }), providerXg: nullable({ type: 'number' }), usesForm: { type: 'boolean' } }), additionalProperties: true },
    },
  },
}
