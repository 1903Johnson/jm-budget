// ─── SERVICE WORKER v4 ───
// Strategy: Network-first for HTML (always get latest),
// Cache-first for assets (icons, fonts = rarely change)
const CACHE = 'jm-budget-v4';
const HTML_FILES = ['/', '/index.html', './index.html'];

self.addEventListener('install', e => {
  // Skip waiting immediately so new SW activates right away
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(['/manifest.json', '/icon-192.png', '/icon-512.png'])
        .catch(() => {}) // don't fail install if optional assets missing
    )
  );
});

self.addEventListener('activate', e => {
  // Delete ALL old caches immediately
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('SW: deleting old cache', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim()) // take control of all open tabs
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always skip Firebase, CDN, Google APIs — go straight to network
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('jsdelivr') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('fonts.')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // HTML files → NETWORK FIRST (always get latest version)
  const isHTML = e.request.headers.get('accept')?.includes('text/html') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === '/' ||
                 url.pathname === '';
  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Cache the fresh copy
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request)) // fallback to cache if offline
    );
    return;
  }

  // Everything else → cache first, then network
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
    )
  );
});
