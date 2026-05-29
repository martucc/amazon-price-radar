const CACHE_NAME = 'price-radar-cache-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './mockData.js',
  './manifest.json',
  './icon.svg'
];

// Install Event - Cache Static Assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching static resources...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean Up Old Caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Cache-First Strategy with Network Fallback
self.addEventListener('fetch', event => {
  // Ignora le richieste API esterne (come Gemini o Telegram o Scraper) per non interferire con i dati in tempo reale
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Servire da cache
          return cachedResponse;
        }

        // Altrimenti richiedere via rete
        return fetch(event.request).then(response => {
          // Se la risposta è valida, la inseriamo anche nella cache dinamicamente
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      }).catch(() => {
        // Gestione offline per file HTML principali
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});
