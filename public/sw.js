// Service Worker for Persian Calendar
// Handles notifications on Android (where main thread notifications may be suppressed)
// Also enables basic offline caching for the app shell.

const CACHE_NAME = 'persian-calendar-v1';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app shell, network-first otherwise
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Handle notification clicks (Android behavior)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// Listen for messages from main thread to show notifications
// This is the Android-friendly path: when the page is in the background,
// we can still show notifications via the service worker.
self.addEventListener('message', (event) => {
  if (!event.data) return;
  const { type, payload } = event.data;

  if (type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag } = payload || {};
    event.waitUntil(
      self.registration.showNotification(title || 'تقویم شمسی', {
        body: body || '',
        icon: icon || '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        dir: 'rtl',
        lang: 'fa',
        tag: tag || 'calendar',
        vibrate: [200, 100, 200], // Android vibration pattern
        requireInteraction: false,
      })
    );
  }
});
