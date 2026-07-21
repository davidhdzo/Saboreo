/* Saboreo · service worker (v2)
   Objetivo: que la app CARGUE RÁPIDO y a la vez se ACTUALICE RÁPIDO.
   - HTML (la app): primero red, y si no hay internet, cache -> siempre ves la última versión online.
   - Resto de archivos propios (data.js, leaflet, iconos): se sirven al instante desde cache
     y se refrescan en segundo plano (stale-while-revalidate).
   - El mapa (cartocdn) va siempre por red: necesita internet. */
const CACHE = 'saboreo-v2';
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
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // El mapa y cualquier cosa externa: directa a la red, sin tocar.
  if (url.origin !== self.location.origin) return;

  // La app (navegación / HTML): primero RED para ver siempre lo último; cache como respaldo offline.
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
