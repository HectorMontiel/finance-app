// Mis Finanzas — funciona sin red con lo último que bajó.
const V = 'mf-8';
const BASE = ['./', 'index.html', 'app.css?v=8', 'app.js?v=8', 'vendor/supabase.js?v=8', 'icono.svg', 'icono-180.png', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const red = url.pathname.includes('/datos/') || e.request.mode === 'navigate';
  if (red) {
    // Primero la red (datos frescos); sin red, la última copia.
    const clave = new Request(url.origin + url.pathname);
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) { const c = r.clone(); caches.open(V).then((ca) => ca.put(clave, c)); }
      return r;
    }).catch(() => caches.match(clave).then((r) => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
    if (resp.ok) { const c = resp.clone(); caches.open(V).then((ca) => ca.put(e.request, c)); }
    return resp;
  })));
});
