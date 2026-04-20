const CACHE_NAME = 'venueiq-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/chat.css',
  '/css/heatmap.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/dashboard.js',
  '/js/heatmap.js',
  '/js/simulator.js',
  '/js/gemini.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Cache-first strategy for static assets, network fallback
// Network-only for API requests
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error": "Offline"}', { status: 503 })));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache dynamic assets if they are valid
        if(!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseToCache));
        return response;
      });
    })
  );
});
