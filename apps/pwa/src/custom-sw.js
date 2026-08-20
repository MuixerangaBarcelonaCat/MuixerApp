// Custom Service Worker — wraps Angular ngsw for caching and adds Web Push handlers.
// importScripts loads Angular's ngsw-worker first for caching; our push listener below
// takes priority because ngsw does not register a push event handler by default.
importScripts('./ngsw-worker.js');

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const { title, body, url, icon } = data;

  event.waitUntil(
    self.registration.showNotification(title || 'MuixerApp', {
      body: body || '',
      icon: icon || '/icons/icon-192.png',
      data: { url },
      vibrate: [200, 100, 200],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.visibilityState === 'visible');
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
