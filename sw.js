// JUMP Functional & Fitness — Service Worker v23
const CACHE = 'jump-v23';
const PRECACHE = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(PRECACHE)
    ).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Solo cachear recursos propios (no Firebase ni externos)
  if (!req.url.startsWith(self.location.origin)) return;

  const isPage = req.mode === 'navigate'
    || req.url.endsWith('/index.html')
    || req.url.endsWith('/');

  if (isPage) {
    // Páginas (index.html): siempre intenta traer la versión más reciente del servidor.
    // Así las actualizaciones llegan al instante, sin reinstalar la app.
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
          return resp;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Resto de recursos propios (manifest, íconos, etc.): caché primero, con red de respaldo
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
