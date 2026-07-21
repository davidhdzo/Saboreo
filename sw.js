/* Saboreo · service worker
   Cachea la "carcasa" de la app (HTML, datos, Leaflet, iconos) para que
   arranque al instante y funcione sin conexión.
   Las baldosas del mapa (cartocdn) van siempre por red: necesitan internet. */
const CACHE = 'saboreo-v1';
const SHELL = [
  './',
  './index.html',
  './data.js',
  './manifest.json',
  './leaflet/leaflet.css',
  './leaflet/leaflet.js',
  './icon-180.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Solo gestionamos lo del propio dominio (la app). El resto (mapa) va por red.
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      // guarda en caché lo nuevo del propio dominio
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
