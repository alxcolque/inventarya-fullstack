// Service Worker para soporte Offline en POS (/tienda/*)
const CACHE_NAME = 'inventarya-pos-v1';

// Recursos esenciales del shell inicial
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
];

// 1. Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Error al precachear recursos base:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activación y limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Eliminando caché obsoleta:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interceptación de peticiones (Fetch)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Extraer la URL de la petición
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // 2. IGNORAR peticiones de extensiones (chrome-extension://, moz-extension://, etc.) o esquemas no soportados
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // 3. Solo cachear peticiones con método GET (Cache Storage API no soporta POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') {
    return;
  }

  // 4. No interceptar peticiones de API ni autenticación (se gestionan en la capa React con IndexedDB)
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/sanctum')) {
    return;
  }

  // 5. NO GUARDAR IMÁGENES EN CACHÉ (Instrucción explícita: funcionamiento offline sin imágenes)
  const isImage = 
    request.destination === 'image' || 
    url.pathname.match(/\.(png|jpg|jpeg|webp|gif|bmp|ico)$/i) ||
    url.pathname.startsWith('/storage/');

  if (isImage) {
    event.respondWith(
      fetch(request).catch(() => {
        // En offline, retornar un SVG transparente placeholder de 1x1
        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><rect width="1" height="1" fill="transparent"/></svg>',
          { headers: { 'Content-Type': 'image/svg+xml' } }
        );
      })
    );
    return;
  }

  // 6. Peticiones de Navegación HTML (ej: recargar /tienda/tienda-1 offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match('/index.html') || await cache.match('/');
        if (cachedIndex) {
          return cachedIndex;
        }
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>POS Offline</title></head><body><div id="root">Cargando modo offline...</div></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
    );
    return;
  }

  // 7. Peticiones estáticas (JS, CSS, fuentes, assets construidos por Vite)
  // Estrategia: Network first con fallback a caché, y guardar en caché los bundles para offline
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Retornar de caché y actualizar en segundo plano si hay red
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse.clone()).catch(() => {});
              });
            }
          })
          .catch(() => {/* Offline, no problem */});
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          // Guardar bundles JS/CSS generados en caché
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (url.pathname.startsWith('/assets/') ||
              url.pathname.endsWith('.js') ||
              url.pathname.endsWith('.css') ||
              url.pathname.endsWith('.woff2'))
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(async (err) => {
          // Fallback si falló la red y no está en caché
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match(request);
          if (fallback) return fallback;
          throw err;
        });
    })
  );
});
