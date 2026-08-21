const CACHE_NAME = 'healthfood-ai-v1.6';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/themes.css',
  './css/main.css',
  './css/responsive.css',
  './js/api-client.js',
  './js/theme-manager.js',
  './js/language-manager.js',
  './js/notification-manager.js',
  './js/legal.js',
  './js/food.js',
  './js/chatbot.js',
  './js/app.js',
  './i18n/en.json',
  './i18n/te.json',
  './i18n/hi.json',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg'
];

// Install Event — Cache Application Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching Application Shell');
      return Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => console.warn(`[ServiceWorker] Failed to cache ${asset}:`, err))
        )
      );
    })
  );
});

// Activate Event — Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing stale cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Cache-First for static assets, Network-First for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-http/https requests (e.g., chrome-extension://, moz-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle API Requests (Network First for GET, direct fetch for POST/etc.)
  if (url.pathname.startsWith('/api/')) {
    if (event.request.method !== 'GET') {
      event.respondWith(
        fetch(event.request).catch(() => {
          return new Response(
            JSON.stringify({
              success: false,
              offline: true,
              message: 'You are currently offline. POST operations are not available offline.'
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
      );
      return;
    }

    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return new Response(
              JSON.stringify({
                success: false,
                offline: true,
                message: 'You are currently offline. Displaying cached application state.'
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Handle Static Asset Requests (Cache First, then Network)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok && event.request.method === 'GET') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    }).catch(() => {
      if (event.request.headers.get('accept')?.includes('text/html')) {
        return caches.match('/index.html');
      }
    })
  );
});
