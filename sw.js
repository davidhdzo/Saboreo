/* Saboreo · service worker (v3)
   - HTML (la app): primero red, cache de respaldo -> siempre ves lo último online.
   - Archivos propios (data.js, leaflet, iconos): cache al instante + refresco en segundo plano.
   - Baldosas del mapa (cartocdn): cache-first -> una vez vistas, cargan AL INSTANTE y no se
     recargan una y otra vez. Se guardan en una caché aparte para no mezclarlas con la app. */
const CACHE = 'saboreo-v4';
const TILES = 'saboreo-tiles-v1';
const SHELL = [
  './',
  './index.html',
  './data.js',
  './supabase.js',
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
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Baldosas del mapa: cache primero (rapidísimo), y si no está, red y se guarda.
  if (url.hostname.endsWith('basemaps.cartocdn.com')) {
    e.respondWith(
      caches.open(TILES).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        c.put(req, res.clone()).catch(() => {});
        return res;
      })))
    );
    return;
  }

  // Cualquier otra cosa externa: directa a la red.
  if (url.origin !== self.location.origin) return;

  // La app (HTML): primero red, cache de respaldo.
  const isHTML = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isHTML) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Resto de archivos propios: cache al instante + refresco en segundo plano.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
