// Jonathan Porras | Preparación Física — Service Worker v24
// Cambiar el número de versión obliga a los celulares a borrar la caché vieja de JUMP
const CACHE = 'jp-v28';
const PRECACHE = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
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
  // Solo se cachean archivos propios y solo lecturas; Firebase y Google nunca pasan por la caché
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  const isPage = req.mode === 'navigate' || req.url.endsWith('/index.html') || req.url.endsWith('/');

  if (isPage) {
    // La página siempre se pide primero al servidor, así las actualizaciones llegan al instante
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(resp => {
          if (resp.ok) { const copy = resp.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return resp;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Manifest e íconos: caché primero, red de respaldo
  e.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});
