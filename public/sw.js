// Basic Service Worker for PWA installation support
const CACHE_NAME = 'laporra-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch handler (required for PWA install criteria)
  event.respondWith(fetch(event.request));
});
