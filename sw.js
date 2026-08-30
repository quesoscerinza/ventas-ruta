/* Service worker: la app queda guardada en el celular y abre sin señal.

   IMPORTANTE — cada vez que suba cambios a GitHub, SUBA ESTE NUMERO.
   Es lo que bota el caché viejo de todos los celulares y los obliga a
   recoger la versión nueva. Sin esto un celular puede quedarse semanas
   con la versión anterior sin que nadie se entere. */
const VERSION = 2;

const CACHE = `cerinza-ruta-v${VERSION}`;
const ARCHIVOS = [
  './', './index.html', './manifest.json',
  './css/estilo.css',
  './js/app.js', './js/db.js', './js/util.js',
  './js/escpos.js', './js/printer.js', './js/ticket.js'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Red primero para tener siempre la última versión; si no hay señal, del caché. */
self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(
    fetch(ev.request)
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(ev.request, copia)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(ev.request).then(r => r || caches.match('./index.html')))
  );
});
