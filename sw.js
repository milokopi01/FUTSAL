const CACHE_NAME = 'futsal-pk-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[ServiceWorker] Membuka cache dan menyimpan aset statik utama.');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Paksa service worker baharu untuk mengambil alih segera
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Memadam cache lapuk:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Kawal segera semua klien di bawah skop
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Biarkan panggilan ke Google Apps Script diuruskan oleh pelayar (Network Only)
  if (event.request.url.includes('script.google.com') || event.request.method === 'POST') {
    return; // Tidak masuk ke dalam cache fetch API
  }

  // Strategi Cache-First untuk aset web statik
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(response => {
        // Jika wujud di cache, kembalikan dari cache (Sangat pantas dan offline)
        if (response) {
          return response;
        }
        
        // Jika tidak, muat turun dari sumber asal (Network)
        return fetch(event.request).then(networkResponse => {
          // Jangan cache respons yang gagal
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          
          // (Pilihan) Simpan respons baharu ke cache secara dinamik
          let responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          
          return networkResponse;
        });
      })
    );
  }
});
