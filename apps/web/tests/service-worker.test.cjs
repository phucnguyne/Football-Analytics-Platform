const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')

function loadWorker() {
  const handlers = {}
  const showNotification = jest.fn()
  const openWindow = jest.fn()
  const self = {
    addEventListener: (type, listener) => { handlers[type] = listener },
    location: { origin: 'https://football.example' },
    registration: { showNotification },
    clients: { matchAll: async () => [], openWindow },
  }
  runInNewContext(readFileSync(require.resolve('../public/sw.js'), 'utf8'), { self, URL })
  return { handlers, showNotification, openWindow }
}

test('a delivered push shows a localized score and opens its match on click', async () => {
  const { handlers, showNotification, openWindow } = loadWorker()
  const notification = { title: 'Bàn thắng', body: 'Arsenal 1–0 Liverpool', matchId: 42, tag: '42:goal:1:0' }
  const waitUntil = jest.fn()
  handlers.push({ waitUntil, data: { json: () => notification } })
  await waitUntil.mock.calls[0][0]
  const options = showNotification.mock.calls[0][1]
  expect(showNotification).toHaveBeenCalledWith('Bàn thắng', expect.objectContaining({ tag: notification.tag, body: notification.body }))
  handlers.notificationclick({ waitUntil, notification: { data: options.data, close: jest.fn() } })
  await waitUntil.mock.calls[1][0]
  expect(openWindow).toHaveBeenCalledWith('https://football.example/matches/42')
})

test('the worker leaves authenticated APIs and write requests to the network', () => {
  const { handlers } = loadWorker()
  const respondWith = jest.fn()
  for (const [method, pathname] of [['GET', '/api/dashboard'], ['GET', '/api/platform-stats'], ['GET', '/api/predictions/season'], ['GET', '/api/auth/session'], ['GET', '/api/matches?status=IN_PLAY'], ['PUT', '/api/favorites/42']]) {
    handlers.fetch({ request: { method, url: 'https://football.example' + pathname }, respondWith })
  }
  expect(respondWith).not.toHaveBeenCalled()
})
