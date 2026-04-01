/* IRPG PDF Reader – Service Worker (offline cache) */
const CACHE_NAME = 'irpg-cache-v2';

// Derive the base path from the service worker script URL so this file works
// correctly whether the app is served at the root ('/') or a sub-path like
// '/IRPG/'. E.g. '/IRPG/sw.js' → BASE_PATH = '/IRPG'
const BASE_PATH = self.location.pathname.replace(/\/sw\.js$/, '');

// Assets to pre-cache on install
const PRECACHE_URLS = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin resources
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // Cache a clone of the response
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, toCache);
          });
          return response;
        })
        .catch(() => {
          // Offline fallback: return cached index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match(BASE_PATH + '/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
    }),
  );
});
