import { sendWebPushNotifications } from '@/lib/webPush';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export async function sendPushToUser(username: string, payload: PushPayload) {
  try {
    return await sendWebPushNotifications(
      { patientId: username, role: 'patient' },
      {
        title: payload.title,
        body: payload.body,
        url: payload.url,
        icon: payload.icon,
      },
    );
  } catch (err: unknown) {
    console.warn('[Web Push sendPush]', err instanceof Error ? err.message : err);
  }
}
