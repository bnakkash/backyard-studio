// Backyard Studio service worker — offline support.
// Bump CACHE when you ship a new HTML build so clients refresh.
const CACHE = 'backyard-studio-v10';

const PRECACHE = [
  './',
  './backyard-studio.html',
  './manifest.webmanifest',
  './icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Tolerate individual failures (e.g. CDN flakes during install)
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const req = new Request(url, url.startsWith('http') ? { mode: 'no-cors' } : {});
        const res = await fetch(req);
        await cache.put(req, res);
      } catch (_) { /* skip */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      // Runtime-cache successful, cacheable responses
      if (res && (res.type === 'basic' || res.type === 'cors' || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (_) {
      // Offline fallback: serve the app shell for navigations
      if (req.mode === 'navigate') {
        const shell = await caches.match('./backyard-studio.html');
        if (shell) return shell;
      }
      throw _;
    }
  })());
});
