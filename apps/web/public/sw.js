const cacheName = 'fa-pro-offline-v3'
const offlinePage = '/offline.html'
const publicPage = /^\/(?:matches(?:\/\d+)?|teams(?:\/\d+(?:\/scouting)?)?|players(?:\/(?:\d+|compare))?|standings)?\/?$/
const publicApi = /^\/api\/(?:competitions\/[A-Z0-9]+\/(?:standings|teams|matches|seasons)|teams\/\d+(?:\/scouting|\/matches)?|persons(?:\/\d+(?:\/(?:career|form|heatmap|similar))?|\/compare)?|matches\/\d+(?:\/(?:shots|tactics|stats))?)$/

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.add(offlinePage)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('fa-pro-offline-') && key !== cacheName)
      .map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

function canCache(response, navigation) {
  const cacheControl = response.headers.get('Cache-Control') ?? ''
  return response.ok && !response.redirected && (navigation || !/private|no-store/i.test(cacheControl))
}

async function networkFirst(request, navigation) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (canCache(response, navigation)) {
      try {
        await cache.put(request, response.clone())
        const keys = (await cache.keys()).filter(({ url }) => !url.endsWith(offlinePage) && !url.includes('/_next/static/'))
        await Promise.all(keys.slice(0, Math.max(0, keys.length - 60)).map((key) => cache.delete(key)))
      } catch {
        // A full cache must not prevent online navigation.
      }
    }
    return response
  } catch {
    return (await cache.match(request)) ??
      (navigation ? await cache.match(offlinePage) : Response.error())
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Only public HTML goes into shared browser storage.
    event.respondWith(publicPage.test(url.pathname)
      ? networkFirst(request, true)
      : fetch(request).catch(() => caches.match(offlinePage)))
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (canCache(response, false)) {
        try {
          await cache.put(request, response.clone())
        } catch {
          // The network response remains available.
        }
      }
      return response
    })())
  } else if (publicApi.test(url.pathname)) {
    event.respondWith(networkFirst(request, false))
  }
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  event.waitUntil((async () => {
    const { title, body, matchId, tag } = event.data.json()
    if (!Number.isInteger(matchId) || matchId <= 0) return
    await self.registration.showNotification(title, {
      body, tag, icon: '/pwa-192.png', data: { path: `/matches/${matchId}` },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification.data?.path
  if (!/^\/matches\/\d+$/.test(path)) return
  const url = new URL(path, self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((window) => window.url === url)
    if (existing) return existing.focus()
    return self.clients.openWindow(url)
  })())
})
