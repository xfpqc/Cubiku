const CACHE_NAME = 'cubiku-v45';
const ASSETS = [
  '/',
  '/index.html',
  '/static/style.css?v=44', // Keep these at 44 to match your current HTML
  '/static/game.js?v=44',
  '/static/icon-512.png',
  '/static/manifest.json'
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
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      // 1. CACHE HIT: Serve immediately and DO NOT ping the network.
      // This stops the browser tab from spinning while Render wakes up.
      if (cached) {
        return cached;
      }

      // 2. CACHE MISS: Try the network. 
      return fetch(event.request)
        .then((response) => {
          // Store the successful network response in cache for next time
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // 3. OFFLINE / RENDER ASLEEP FALLBACK:
          // If the network fails entirely, ensure page navigations load the app.
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html', { ignoreSearch: true });
          }
        });
    })
  );
});