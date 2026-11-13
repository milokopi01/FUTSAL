/* =========================================================
   SERVICE WORKER - LIVE FUTSAL PK KBB 2026
   - HTML (index.html): Network-first -> sentiasa versi terkini bila ada internet,
     guna salinan cache bila luar talian.
   - Aset statik (manifest, ikon, fon): Stale-while-revalidate.
   - Permintaan Google Apps Script / POST tidak disentuh.
   Naikkan CACHE_VERSION setiap kali anda mengemas kini fail di GitHub.
   ========================================================= */
const CACHE_PREFIX = 'futsal-pk-kbb-';
const CACHE_VERSION = 'v1.14.1';
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${CACHE_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const BYPASS_HOSTS = ['script.google.com', 'script.googleusercontent.com'];

// ---------- INSTALL: simpan aset utama ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => Promise.allSettled(
        CORE_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      ))
      .then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE: buang cache versi lama ----------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))
    );
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) { /* abaikan */ }
    }
    await self.clients.claim();
  })());
});

// Benarkan halaman meminta SW baharu aktif serta-merta
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ---------- FETCH ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (BYPASS_HOSTS.some((h) => url.hostname.endsWith(h))) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const sameOrigin = url.origin === self.location.origin;
  const isHtml = req.mode === 'navigate' ||
    (sameOrigin && (req.headers.get('accept') || '').includes('text/html'));

  if (isHtml && sameOrigin) {
    event.respondWith(networkFirst(event));
    return;
  }
  if (sameOrigin || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(event) {
  const req = event.request;
  const cache = await caches.open(STATIC_CACHE);
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    const res = preload || await fetch(req);
    if (res && res.ok) cache.put('./index.html', res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match('./index.html') || await cache.match('./');
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Luar Talian</title><body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center">' +
      '<div><h1>⚽ Luar Talian</h1><p>Tiada sambungan internet. Sila cuba lagi sebentar.</p></div></body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await caches.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}
