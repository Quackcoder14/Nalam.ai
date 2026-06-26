// Firebase Cloud Messaging Service Worker for Nalam.ai
// This file MUST live at /public/firebase-messaging-sw.js
// It handles background push messages while the app is not in focus.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyCAmkV1i2s01gfHgyXsWdMKVSztsLH4iAE',
  authDomain:        'nalam-ai-bb4f0.firebaseapp.com',
  projectId:         'nalam-ai-bb4f0',
  storageBucket:     'nalam-ai-bb4f0.firebasestorage.app',
  messagingSenderId: '15761224627',
  appId:             '1:15761224627:web:da7f64b2a877a980a191c6',
});

const messaging = firebase.messaging();

// Handle background messages (when app tab is in background/closed)
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon, url } = payload.notification || payload.data || {};

  self.registration.showNotification(title || 'nalam.ai', {
    body:    body    || 'You have a new notification.',
    icon:    icon    || '/icon-192.png',
    badge:              '/icon-192.png',
    data:    { url: url || '/dashboard' },
    actions: [
      { action: 'open',    title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  });
});

// Handle notification click from background
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
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
