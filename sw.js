/* ============================================
   SW.JS — Service Worker
   Élev v2 — Fonctionne en local ET sur GitHub Pages (/elev-v2/)
   ============================================ */

const CACHE_VERSION = 'elev-v2-cache-v6';

// Détecte le base path dynamiquement (fonctionne partout)
const BASE = self.location.pathname.replace(/\/sw\.js$/, '');

const STATIC_ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/css/base.css',
  BASE + '/css/components.css',
  BASE + '/css/animations.css',
  BASE + '/js/supabase.js',
  BASE + '/js/utils.js',
  BASE + '/js/offline.js',
  BASE + '/js/app-auth.js',
  BASE + '/js/app.js',
  BASE + '/js/home.js',
  BASE + '/js/rest-timer.js',
  BASE + '/js/workouts.js',
  BASE + '/js/workouts-render.js',
  BASE + '/js/workouts-sets.js',
  BASE + '/js/routines-data.js',
  BASE + '/js/routines.js',
  BASE + '/js/routines-editor.js',
  BASE + '/js/fooddb.js',
  BASE + '/js/food-catalog.js',
  BASE + '/js/barcode.js',
  BASE + '/js/food-picker.js',
  BASE + '/js/food-picker-detail.js',
  BASE + '/js/nutrition-ui.js',
  BASE + '/js/nutrition.js',
  BASE + '/js/recipes.js',
  BASE + '/js/weight-chart.js',
  BASE + '/js/weight.js',
  BASE + '/js/coach.js',
  BASE + '/js/coach-ui.js',
  BASE + '/js/onboarding.js',
  BASE + '/js/profile.js',
  BASE + '/js/history.js',
  BASE + '/js/stats.js',
  BASE + '/js/swipe.js',
];

/* --- Install : pré-cache les assets statiques --- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      // addAll échoue silencieusement si un asset manque
      Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

/* --- Activate : nettoie les vieux caches --- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* --- Fetch : Network-first pour API, Cache-first pour assets --- */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes externes (Supabase, CDN, Google Fonts…)
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
