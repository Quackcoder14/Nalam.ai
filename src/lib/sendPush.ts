// Server utility — send a push notification to a specific user via FCM
// Import and call this from any API route that needs to notify a user.
import { getAdminMessaging } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;       // URL to open when notification is tapped
  icon?: string;
}

/**
 * Sends an FCM push notification to a user by their username.
 * Silently no-ops if the user has no FCM token registered.
 */
export async function sendPushToUser(username: string, payload: PushPayload) {
  try {
    // Fetch the FCM token from DB
    const record = await prisma.fcmToken.findUnique({
      where: { username },
    });

    const token = record?.token;
    if (!token) return; // User hasn't registered for push yet

    const messaging = getAdminMessaging();

    await messaging.send({
      token,
      notification: {
        title: payload.title,
        body:  payload.body,
        imageUrl: payload.icon || undefined,
      },
      webpush: {
        fcmOptions: {
          link: payload.url || '/dashboard',
        },
        notification: {
          icon:  payload.icon  || '/icon-192.png',
          badge: '/icon-192.png',
        },
      },
    });
  } catch (err: any) {
    // Non-fatal — log and continue
    console.warn('[FCM sendPush]', err.message);
  }
}
