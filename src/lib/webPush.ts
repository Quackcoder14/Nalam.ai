import webpush, { PushSubscription as WebPushSubscription } from 'web-push';
import type { PushSubscription as DBPushSubscription } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@nalam.ai';

let vapidConfigured = false;

function configureWebPush() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || vapidConfigured) return;
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
}

export function isWebPushConfigured() {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  severity?: string;
  tag?: string;
}

export interface WebPushFilter {
  patientId?: string;
  role?: string;
}

export interface WebPushResult {
  sent: number;
  failed: number;
  total: number;
  expired: number;
  skipped?: boolean;
  reason?: string;
}

export async function sendWebPushNotifications(
  filter: WebPushFilter,
  payload: WebPushPayload,
): Promise<WebPushResult> {
  if (!isWebPushConfigured()) {
    return { sent: 0, failed: 0, total: 0, expired: 0, skipped: true, reason: 'VAPID keys not configured' };
  }

  configureWebPush();

  const where: Record<string, string> = {};
  if (filter.patientId) where.patient_id = filter.patientId;
  if (filter.role) where.role = filter.role;

  const subscriptions = await prisma.pushSubscription.findMany({ where });
  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, total: 0, expired: 0, reason: 'No subscriptions found' };
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    severity: payload.severity || 'info',
    tag: payload.tag || payload.severity || 'nalam-alert',
    url: payload.url || '/dashboard',
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub: DBPushSubscription) => {
      const keys = JSON.parse(sub.keys_json) as WebPushSubscription['keys'];
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys } as WebPushSubscription,
        notificationPayload,
        { TTL: 60 * 60 },
      );
      return sub.endpoint;
    }),
  );

  const expiredEndpoints: string[] = [];
  let sent = 0;
  let failed = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      sent += 1;
      return;
    }

    failed += 1;
    const statusCode = result.reason?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      expiredEndpoints.push(subscriptions[index].endpoint);
    }
  });

  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: expiredEndpoints } },
    });
  }

  return {
    sent,
    failed,
    total: subscriptions.length,
    expired: expiredEndpoints.length,
  };
}
