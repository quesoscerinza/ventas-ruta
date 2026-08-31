/* Service worker: la app queda guardada en el celular y abre sin señal.

   IMPORTANTE — cada vez que suba cambios a GitHub, SUBA ESTE NUMERO.
   Es lo que bota el caché viejo de todos los celulares y los obliga a
   recoger la versión nueva. Sin esto un celular puede quedarse semanas
   con la versión anterior sin que nadie se entere. */
const VERSION = 11;

const CACHE = `cerinza-ruta-v${VERSION}`;
const ARCHIVOS = [
  './', './index.html', './manifest.json',
  './css/estilo.css',
  './js/app.js', './js/db.js', './js/util.js', './js/usuarios.js',
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

/* Recibir un archivo compartido desde WhatsApp.

   Android manda el archivo aquí por POST cuando el vendedor elige la app
   en el menú Compartir. Lo guardamos y mandamos la app a abrirse con una
   marca en la dirección; ella lo recoge y lo procesa. Esto evita que el
   vendedor tenga que buscar carpetas: los documentos de WhatsApp viven en
   un sitio que el selector de archivos de Android ya no deja ver. */
self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  if (ev.request.method === 'POST' && url.pathname.endsWith('/compartir')) {
    ev.respondWith((async () => {
      try {
        const formulario = await ev.request.formData();
        const archivo = formulario.get('archivo');
        const texto = await archivo.text();
        const bandeja = await caches.open('compartido');
        await bandeja.put('/ultimo', new Response(texto, {
          headers: { 'x-nombre': archivo.name || 'archivo.json' }
        }));
      } catch (e) { /* si falla, la app lo dirá al no encontrar nada */ }
      return Response.redirect('./?compartido=1', 303);
    })());
    return;
  }

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
