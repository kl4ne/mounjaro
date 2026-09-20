/**
 * GLP-1 Companion v5.1.0 production service worker.
 * Custom SW retained intentionally for predictable GitHub Pages behavior.
 */

const BUILD_ID = 'v5.1.0-pwa';
const CACHE_PREFIX = 'glp1-v5-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${BUILD_ID}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${BUILD_ID}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './assets/app.css',
  './assets/main.js',
  './assets/firebase/platform.js',
  './assets/firebase/ai-logic.js',
  './assets/pwa/update-manager.js',
  './runtime/01-core-platform.js',
  './runtime/02-state-sync-storage.js',
  './runtime/03-medication-domain.js',
  './runtime/04-navigation-dashboard.js',
  './runtime/05-nutrition-ai-ui.js',
  './runtime/06-injections-symptoms.js',
  './runtime/07-tools-reports-backups.js',
  './runtime/08-lifecycle-bootstrap.js',
  './runtime/09-ai-intelligence.js',
];

self.addEventListener('install', (event) => {
  // Do not skipWaiting here. The page decides when activation is safe.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (
    data.type === 'ACTIVATE_UPDATE' ||
    data.type === 'SKIP_WAITING' ||
    data.action === 'skipWaiting'
  ) {
    self.skipWaiting();
    return;
  }

  if (data.type === 'GET_BUILD_INFO') {
    const reply = {
      type: 'BUILD_INFO',
      buildId: BUILD_ID
    };

    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(reply);
    } else if (event.source) {
      event.source.postMessage(reply);
    }
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(
            (key) =>
              (
                key.startsWith('glp1-cache-') ||
                key.startsWith(CACHE_PREFIX)
              ) &&
              key !== SHELL_CACHE &&
              key !== RUNTIME_CACHE
          )
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

async function networkFirst(
  request,
  cacheName,
  fallbackRequest = null
) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request, {
      cache: 'no-store'
    });

    if (
      response &&
      (response.ok || response.type === 'opaque')
    ) {
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch (_) {
    return (
      (await cache.match(request)) ||
      (fallbackRequest
        ? await caches.match(fallbackRequest)
        : undefined) ||
      Response.error()
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) return cached;

  const response = await fetch(request);

  if (
    response &&
    (response.ok || response.type === 'opaque')
  ) {
    cache.put(request, response.clone()).catch(() => {});
  }

  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // HTML navigation must prefer the network so a newly deployed build is seen.
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(
        request,
        SHELL_CACHE,
        './index.html'
      )
    );
    return;
  }

  // Never intercept API/data traffic.
  // Firebase/AI requests keep their native path.
  const staticDestination = [
    'script',
    'style',
    'font',
    'image',
    'manifest'
  ].includes(request.destination);

  if (!staticDestination) return;

  if (sameOrigin) {
    // Runtime JS uses stable filenames.
    // Network-first prevents an old cached runtime module
    // from being executed after a new deployment.
    if (
      ['script', 'style', 'manifest'].includes(
        request.destination
      )
    ) {
      event.respondWith(
        networkFirst(request, RUNTIME_CACHE)
      );
      return;
    }

    // Images/fonts are safe cache-first.
    event.respondWith(
      cacheFirst(request, RUNTIME_CACHE)
    );
    return;
  }

  // External static libraries remain available offline.
  event.respondWith(
    cacheFirst(request, RUNTIME_CACHE)
  );
});
