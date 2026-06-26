// API Route: POST /api/fcm/test
// Sends a test push notification to a user to verify FCM pipeline end-to-end.
import { NextRequest, NextResponse } from 'next/server';
import { sendPushToUser } from '@/lib/sendPush';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    await sendPushToUser(userId, {
      title: '✅ Nalam.ai Notifications Enabled',
      body: 'You will now receive appointment and health alerts. Stay safe!',
      url: '/dashboard',
      icon: '/icon-192.png',
    });

    return NextResponse.json({ ok: true, message: 'Test notification sent' });
  } catch (err: any) {
    console.error('[FCM test]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
