const CACHE_NAME = 'kolonie-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './main.js',
  './physics.js',
  './rendering.js',
  './audio.js',
  './ui.js',
  './manifest.webmanifest',
  './icons/icon-192.PNG',
  './icons/icon-512.PNG'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

