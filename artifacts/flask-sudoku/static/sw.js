const CACHE_NAME = 'cubiku-v11';
const ASSETS_TO_CACHE = [
  '/',
  '/static/style.css',
  '/static/game.js',
  '/static/icon-512.png',
  '/static/manifest.json'
];

// Install event: cache initial assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old cache versions
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

// Fetch event: NETWORK FIRST, dynamically update cache, fall back to cache if offline
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Clone the fresh response from the server
        const responseClone = networkResponse.clone();
        
        // Open the cache and update it with the fresh file
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        
        return networkResponse;
      })
      .catch(() => {
        // If the network fails (you are offline), pull the last saved version from cache, ignoring ?v= tags
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});