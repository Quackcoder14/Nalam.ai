'use client';
import { useEffect } from 'react';
import { getFirebaseMessaging } from '@/lib/firebase';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;

/**
 * Registers the browser with FCM and stores the token server-side.
 * Call this hook on any authenticated dashboard (patient/clinician).
 *
 * @param userId - The logged-in user's ID / username from session storage
 */
export function useFCMToken(userId: string | null) {
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;

    let cancelled = false;

    async function register() {
      try {
        // 1. Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // 2. Register the Firebase-aware service worker
        const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/',
        });

        // 3. Get FCM token
        const messaging = await getFirebaseMessaging();
        if (!messaging || cancelled) return;

        const { getToken } = await import('firebase/messaging');
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: sw,
        });

        if (!token || cancelled) return;

        // 4. Save token to our backend (associates device with userId)
        await fetch('/api/fcm/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, token }),
        });
      } catch (err) {
        // Non-fatal — user may have blocked notifications
        console.warn('[FCM] Token registration failed:', err);
      }
    }

    register();
    return () => { cancelled = true; };
  }, [userId]);
}
