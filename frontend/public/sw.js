// THEIAKSHI ENTERPRISE HRMS — PRODUCTION PWA SERVICE WORKER
const CACHE_NAME = 'theiakshi-pwa-v1.0.8';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-512x512.png'
];

// 1. Install Event — Pre-cache core PWA static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event — Clean up outdated cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event — Strict Security & Offline / SPA Navigation Handling
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CRITICAL SECURITY RULE: Never cache API requests or non-GET endpoints
  if (url.pathname.includes('/api/') || event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Handle HTML navigation requests (SPA Routing)
  const isNavigation = event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            return networkResponse;
          }
          // If server returns 404/non-200 for SPA subroute, fallback to /index.html
          return caches.match('/index.html').then((cachedIndex) => {
            return cachedIndex || fetch('/index.html');
          });
        })
        .catch(() => {
          return caches.match('/index.html').then((cachedIndex) => {
            return cachedIndex || fetch('/index.html');
          });
        })
    );
    return;
  }

  // Network-First with Stale Cache Fallback for static assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
