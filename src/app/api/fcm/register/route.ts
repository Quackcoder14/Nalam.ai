// API Route: POST /api/fcm/register
// Stores the FCM device token for a user so we can push notifications to them.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { userId, token } = await req.json();
    if (!userId || !token) {
      return NextResponse.json({ error: 'userId and token required' }, { status: 400 });
    }

    // Upsert: store one FCM token per userId using the FcmToken model
    await prisma.fcmToken.upsert({
      where: { username: userId },
      update: { token },
      create: { username: userId, token },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.warn('[FCM register]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
