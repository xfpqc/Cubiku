const CACHE_NAME = 'cubiku-v54';

// These exact URLs will be downloaded and stored the moment the app is installed
const ASSETS = [
  '/',
  '/index.html',
  '/static/style.css?v=53',
  '/static/game.js?v=53',
  '/static/icon-512.png',
  '/static/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // BUG FIX: Actually pre-cache the core files so the app works offline immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
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

// The strategy you suggested: Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      
      // 1. Start the background network fetch to get the freshest data
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Only cache successful, valid responses
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch((err) => {
          // If offline and we don't have it in cache, fallback to index
          if (!cachedResponse && event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          throw err;
        });

      // 2. IMMEDIATELY return the cached version if we have it (instant offline load).
      // If we don't have it in cache yet, wait for the background fetch to finish.
      return cachedResponse || fetchPromise;
    })
  );
});