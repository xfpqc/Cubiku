const CACHE_NAME = 'cubiku-v50';
const ASSETS = [
  '/',
  '/index.html',
  '/static/style.css?v=50',
  '/static/game.js?v=50',
  '/static/icon-512.png',
  '/static/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); 
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Strict Network-First Strategy to guarantee updates
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid 200 responses (prevents caching the Render Loading page)
        if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});