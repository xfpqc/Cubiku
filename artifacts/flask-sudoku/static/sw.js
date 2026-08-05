const CACHE_NAME = 'cubiku-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/static/style.css',
  '/static/game.js',
  '/static/icon-512.png',
  '/static/manifest.json'
];

// Install event: cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
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
  self.clientsClaim();
});

// Fetch event: NETWORK FIRST, fall back to cache if offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        // If offline, grab from cache
        return caches.match(event.request);
      })
  );
});