const CACHE = 'nalam-v4';

const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/dashboard/chat',
  '/clinician',
  '/hospital-desk',
  '/hospital-desk/chat',
  '/appointments/book',
  '/appointments/requests',
  '/xai',
  '/search',
  '/feed',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS).catch(function () {});
    }),
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
          return caches.delete(key);
        }),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(function (response) {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match('/');
        });
      }),
    );
    return;
  }

  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icon') ||
    url.pathname.startsWith('/favicon')
  ) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).then(function (response) {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      }),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(fetch(event.request).catch(function () {
      return caches.match(event.request);
    }));
  }
});

self.addEventListener('push', function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: 'nalam.ai Alert',
      body: event.data ? event.data.text() : 'Health notification received.',
    };
  }

  const targetUrl = new URL(data.url || '/dashboard', self.location.origin).href;
  const title = data.title || 'nalam.ai Health Alert';
  const options = {
    body: data.body || 'A health update is available.',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || data.severity || 'nalam-alert',
    renotify: true,
    data: { url: targetUrl },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
