'use client';
import { useEffect, useCallback } from 'react';
import { getFirebaseMessaging } from '@/lib/firebase';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

/**
 * Hook to manage Firebase Cloud Messaging (FCM) registration.
 * On mount, it auto-registers ONLY if notification permissions were already granted.
 * It also returns a function to manually request permission and register, suitable for a button onClick.
 */
export function useFCMToken(userId: string | null) {
  const registerFCM = useCallback(async (requestPermission = false) => {
    if (!userId || typeof window === 'undefined' || !VAPID_KEY) return false;

    try {
      // For PWAs and Safari, we only request permission if explicitly asked by a user gesture.
      let permission = Notification.permission;
      if (requestPermission && permission !== 'granted') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') return false;

      console.log('[FCM] Notification permission:', permission);
      console.log('[FCM] Registering service worker…');

      const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      console.log('[FCM] Service worker registered:', sw.scope);

      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        console.warn('[FCM] getFirebaseMessaging() returned null — browser may not support it');
        return false;
      }

      console.log('[FCM] Requesting FCM token with VAPID key:', VAPID_KEY.substring(0, 20) + '…');
      const { getToken } = await import('firebase/messaging');
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: sw,
      });

      if (!token) {
        console.warn('[FCM] No token returned — check VAPID key and Firebase config');
        return false;
      }
      console.log('[FCM] Token obtained:', token.substring(0, 20) + '…');

      // Save token to backend
      const regRes = await fetch('/api/fcm/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token }),
      });
      console.log('[FCM] Token registered with backend:', await regRes.json());

      // Send a test notification to verify the full pipeline
      if (requestPermission) {
        await fetch('/api/fcm/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        console.log('[FCM] Test notification sent!');
      }

      return true;
    } catch (err) {
      console.warn('[FCM] Token registration failed:', err);
      return false;
    }
  }, [userId]);

  useEffect(() => {
    // Auto-register on mount ONLY if permission was already granted previously
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      registerFCM(false);
    }
  }, [registerFCM]);

  useEffect(() => {
    // Listen for foreground messages
    let unsub: any = null;
    getFirebaseMessaging().then(async (messaging) => {
      if (!messaging) return;
      const { onMessage } = await import('firebase/messaging');
      unsub = onMessage(messaging, (payload) => {
        console.log('[FCM Foreground]', payload);
        const event = new CustomEvent('fcm-message', { detail: payload });
        window.dispatchEvent(event);
      });
    });
    return () => { if (unsub) unsub(); };
  }, []);

  return { registerFCM };
}
