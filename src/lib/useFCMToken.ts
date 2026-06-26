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

      const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      const messaging = await getFirebaseMessaging();
      if (!messaging) return false;

      const { getToken } = await import('firebase/messaging');
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: sw,
      });

      if (!token) return false;

      await fetch('/api/fcm/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token }),
      });

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

  return { registerFCM };
}
