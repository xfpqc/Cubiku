const CACHE_NAME = 'cubiku-v26';

const ASSETS_TO_CACHE = [
  '/',
  '/static/style.css?v=26',
  '/static/game.js?v=26',
  '/static/icon-512.png',
  '/static/manifest.json'
];

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active one instantly
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  // Take control of all open clients immediately
  self.clients.claim(); 
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // NETWORK-FIRST STRATEGY: Always fetch fresh code from the server.
  // Only fall back to the cache if the network fails (offline mode).
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If offline, retrieve from cache. 
        // We drop ignoreSearch here so the cache respects exact version strings.
        return caches.match(event.request, { ignoreSearch: !event.request.url.includes('?') });
      })
  );
});