// Service worker: makes the site work offline after the first visit.
// Built by scripts/vite-plugin-sw.ts, which fills in PRECACHE with the build's files.
// - Hashed files (assets, databases, icon atlases) never change: cache first.
// - Everything else (index.html, the database manifest): network first, cache when offline.

const PRECACHE = self.__PRECACHE__
const CACHE = `factorio-calc-${self.__VERSION__}`
const BASE = new URL('./', self.location).pathname

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((file) => BASE + file))))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('factorio-calc-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  // The page asks to switch to this version (after the user chose to reload).
  if (event.data?.type === 'skip-waiting') self.skipWaiting()
  // The page lists files it loaded before this worker was in control, to keep for offline.
  if (event.data?.type === 'cache') event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(event.data.urls)))
})

const immutable = (path) => path.startsWith(`${BASE}assets/`) || (path.startsWith(`${BASE}db/`) && !path.endsWith('manifest.json'))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return
  if (immutable(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ??
          fetch(event.request).then((response) => {
            if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()))
            return response
          }),
      ),
    )
  } else {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()))
          return response
        })
        .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match(`${BASE}index.html`))),
    )
  }
})
