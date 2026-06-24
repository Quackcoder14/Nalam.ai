// nalam.ai Service Worker — Full PWA offline shell + push notifications
const CACHE = 'nalam-v3';

// Pre-cache the full app shell: all routes + assets
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
  '/favicon.ico',
];

// ── Install: cache the full app shell ─────────────────────────
self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

// ── Activate: clear old caches ────────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ────────────────────────────────────────────
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never cache API calls — always go network for API (Render backend)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com')) return;

  // For navigation requests (page loads): Network-first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
    );
    return;
  }

  // For static assets (_next/static, icons, fonts): Cache-first
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icon') || url.pathname.startsWith('/favicon')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(event.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // For everything else from same origin: Network-first, fallback to cache
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});

// ── Push Notifications ────────────────────────────────────────
self.addEventListener('push', function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'nalam.ai Alert', body: event.data ? event.data.text() : 'Health notification received.' };
  }

  const title = data.title || '⚠️ nalam.ai Health Alert';
  const options = {
    body:    data.body    || 'A health anomaly was detected.',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.severity || 'default',
    renotify: true,
    data:    { url: data.url || '/dashboard' },
    actions: [
      { action: 'view',    title: 'View Dashboard' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
