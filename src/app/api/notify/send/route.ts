import { NextResponse } from 'next/server';
import { isWebPushConfigured, sendWebPushNotifications } from '@/lib/webPush';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { patientId, title, message, body: bodyText, severity = 'warning', role, url } = body;

    if (!isWebPushConfigured()) {
      return NextResponse.json({ skipped: true, reason: 'VAPID keys not configured' });
    }

    const result = await sendWebPushNotifications(
      { patientId, role },
      {
        title: title || 'nalam.ai Health Alert',
        body: message || bodyText || 'An anomaly was detected in your vitals.',
        severity,
        url: url || '/dashboard',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      },
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Push send error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Push send failed' }, { status: 500 });
  }
}
