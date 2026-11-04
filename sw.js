const CACHE_NAME = 'cubiku-v58';

const ASSETS = [
  './',
  './index.html',
  './static/style.css?v=58',
  './static/game.js?v=58',
  './static/icon-512.png',
  './static/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // 1. Strict Cache-First for Navigation (HTML page)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      // Explicitly match the cached index.html or root to prevent URL-mismatch misses
      caches.match('./index.html').then((cachedHtml) => {
        return cachedHtml || caches.match('./').then((cachedRoot) => {
          return cachedRoot || fetch(event.request);
        });
      })
    );
    return;
  }

  // 2. Strict Cache-First for Assets (CSS, JS, PNG)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return instantly. DO NOT fetch in the background. 
        // This prevents Render's loading screen from poisoning the cache.
        return cachedResponse;
      }
      
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    })
  );
});