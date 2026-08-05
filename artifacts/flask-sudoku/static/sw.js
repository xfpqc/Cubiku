const CACHE_NAME = 'cubiku-v2'; // Bumped from v1 to v2
const ASSETS_TO_CACHE = [
  '/',
  '/static/style.css',
  '/static/game.js',
  '/static/icon-512.png',
  '/static/manifest.json'
];

// Install event: cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches if versions change
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

// Fetch event: serve from cache first, fall back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        // Optional fallback behavior when offline and asset isn't cached
      });
    })
  );
});