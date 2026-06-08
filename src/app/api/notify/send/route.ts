import { NextResponse } from 'next/server';
import webpush, { PushSubscription as WPSub } from 'web-push';
import { prisma } from '@/lib/prisma';
import type { PushSubscription as DBSub } from '@prisma/client';

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL       || 'mailto:admin@nalam.ai';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { patientId, title, message, severity = 'warning', role } = body;

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json({ skipped: true, reason: 'VAPID keys not configured' });
    }

    // Fetch all subscriptions — optionally filtered by patientId and/or role
    const where: any = {};
    if (patientId) where.patient_id = patientId;
    if (role)      where.role       = role;

    const subs = await prisma.pushSubscription.findMany({ where });
    if (subs.length === 0) {
      return NextResponse.json({ sent: 0, reason: 'No subscriptions found' });
    }

    const payload = JSON.stringify({
      title:   title   || '⚠️ nalam.ai Health Alert',
      body:    message || 'An anomaly was detected in your vitals.',
      icon:    '/favicon.ico',
      badge:   '/favicon.ico',
      severity,
      url:     '/dashboard',
    });

    const results = await Promise.allSettled(
      subs.map(async (sub: DBSub) => {
        const keys = JSON.parse(sub.keys_json) as WPSub['keys'];
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys } as WPSub,
          payload,
        );
        return sub.id;
      })
    );

    const sent   = results.filter((r: PromiseSettledResult<string>) => r.status === 'fulfilled').length;
    const failed = results.filter((r: PromiseSettledResult<string>) => r.status === 'rejected').length;

    // Remove expired subscriptions (HTTP 410 Gone)
    const expiredEndpoints: string[] = [];
    results.forEach((r: PromiseSettledResult<string>, i: number) => {
      if (r.status === 'rejected') {
        const err = (r as PromiseRejectedResult).reason;
        if (err?.statusCode === 410) expiredEndpoints.push(subs[i].endpoint);
      }
    });
    if (expiredEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: expiredEndpoints } },
      });
    }

    return NextResponse.json({ sent, failed, total: subs.length });
  } catch (error: any) {
    console.error('Push send error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
