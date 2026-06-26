// Firebase Admin SDK — server-side only (API routes / Server Actions)
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'
  );

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export function getAdminMessaging() {
  return getMessaging(getAdminApp());
}
