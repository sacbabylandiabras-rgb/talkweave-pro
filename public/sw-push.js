// Web Push Service Worker
 self.addEventListener('install', (event) => {
   event.waitUntil(self.skipWaiting());
 });
 
 self.addEventListener('activate', (event) => {
   event.waitUntil(
     Promise.all([
       self.clients.claim(),
       // Clear old caches if any
       caches.keys().then((cacheNames) => {
         return Promise.all(
           cacheNames.map((cacheName) => caches.delete(cacheName))
         );
       })
     ])
   );
 });

self.addEventListener('push', (event) => {
  let data = { title: 'ZapLynx', body: 'Nova notificação', url: '/' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: (data.tag || 'zaplynx') + '-' + Date.now(),
      renotify: true,
      requireInteraction: false,
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
