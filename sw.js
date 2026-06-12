const CACHE_NAME = 'concordia-restaurator-v2-1-1';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './assets/chainlinks.jpg', './assets/chainlinks.svg', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('script.google.com')) return;
  event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});
