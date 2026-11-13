/* Satu kitaran keluaran: buang hanya cache halaman aplikasi futsal lama. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  try {
    const keys = await caches.keys();
    await Promise.allSettled(keys.filter(k => k.startsWith('futsal-pk-kbb-')).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    await Promise.allSettled(clients.map(c => c.navigate(c.url)));
  } finally { await self.registration.unregister(); }
})()));
