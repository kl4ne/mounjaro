const CACHE_NAME = 'glp1-cache-v4.1.1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

const STATIC_DESTINATIONS = new Set([
  'script',
  'style',
  'font',
  'image',
  'manifest'
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Navigation: network first so updates arrive immediately; cached app shell is the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put('./index.html', copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match('./index.html')) || (await caches.match('./'));
        })
    );
    return;
  }

  // Only cache static browser resources. API/data requests (Firebase, Gemini, etc.) are never cached here.
  if (!STATIC_DESTINATIONS.has(request.destination)) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((networkResponse) => {
        if (!networkResponse) return networkResponse;

        // Same-origin responses must be successful. Cross-origin static assets may be opaque (status 0).
        const isSameOrigin = new URL(request.url).origin === self.location.origin;
        if (isSameOrigin && !networkResponse.ok) return networkResponse;
        if (!isSameOrigin && networkResponse.type !== 'opaque' && !networkResponse.ok) return networkResponse;

        const copy = networkResponse.clone();
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, copy))
          .catch(() => {});
        return networkResponse;
      });
    })
  );
});
