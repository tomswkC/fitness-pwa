// Service worker: makes the tracker installable and usable offline.
//
// The app shell is precached. Navigations are network-first (so a new deploy is
// picked up as soon as you're online) and fall back to the cached shell when
// offline. Static assets are cache-first. The sync API and MCP are never cached
// and never served from cache — the app's own LocalStorage + outbox handle
// offline edits and reconcile on the next sync.
const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = `tracker-personal:${SCOPE.href}:`;
const CACHE = `${CACHE_PREFIX}v4`;
const INDEX = new URL('index.html', SCOPE).href;
const SHELL = [
  './',
  'index.html',
  'personal-data.js',
  'manifest.json',
  'favicon.svg',
  'favicon.ico',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
].map((path) => new URL(path, SCOPE).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const path = url.pathname.slice(SCOPE.pathname.length);
  if (path.startsWith('api/') || path === 'mcp') return;

  if (path === '' || path === 'index.html') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const response = await fetch(req);
          if (response.ok) await cache.put(INDEX, response.clone());
          return response;
        } catch {
          return (await cache.match(INDEX)) || Response.error();
        }
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const response = await fetch(req);
      if (response.ok) await cache.put(req, response.clone());
      return response;
    }),
  );
});
