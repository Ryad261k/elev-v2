/* ============================================
   SW.JS — Service Worker basique
   Élev v2 — Cache-first pour assets statiques
   ============================================ */

const CACHE_NAME = 'elev-v2-cache-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/components.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/supabase.js',
  '/js/workouts.js',
  '/js/routines.js',
  '/js/fooddb.js',
  '/js/food-picker.js',
  '/js/nutrition.js',
  '/js/recipes.js',
  '/js/weight.js',
  '/js/history.js',
  '/js/stats.js',
  '/manifest.json'
];

/* --- Install : pré-cache les assets statiques --- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* --- Activate : nettoie les vieux caches --- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* --- Fetch : Network-first pour API, Cache-first pour assets --- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes Supabase et externes — toujours réseau
  if (!url.origin.includes(self.location.origin)) return;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);

      // Cache-first pour les assets statiques, network-first sinon
      return cached || networkFetch;
    })
  );
});
