// ─── SERVICE WORKER v5 — Force fresh on every update ───
const CACHE_VERSION = 'jm-v5';

self.addEventListener('install', () => {
  // Activate immediately without waiting
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete every old cache instantly
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        console.log('[SW] Deleting cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never cache these — always go to network
  const skipCache = ['firebase','googleapis','gstatic','jsdelivr','fonts.g'];
  if (skipCache.some(s => url.hostname.includes(s))) {
    e.respondWith(fetch(e.request).catch(() => new Response('Offline')));
    return;
  }

  // HTML → always network first so new versions load immediately
  if (e.request.mode === 'navigate' ||
      e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Everything else — network first, cache as fallback
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
