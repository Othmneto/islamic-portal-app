// public/sw.js
self.addEventListener('install', (event) => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { try { payload = JSON.parse(event.data?.text() || '{}'); } catch {} }

  const title = payload.title || 'Notification';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.ico',
    data: payload.data || { url: '/prayertimes.html' },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/prayertimes.html';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      try {
        const clientURL = new URL(client.url);
        const targetURL = new URL(urlToOpen, self.location.origin);
        if (clientURL.pathname === targetURL.pathname) { await client.focus(); return; }
      } catch {}
    }
    await self.clients.openWindow(urlToOpen);
  })());
});
