import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subscription, patientId, role = 'patient' } = body;

    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 });
    }

    // Upsert by endpoint (idempotent — re-subscribing is fine)
    await prisma.pushSubscription.upsert({
      where:  { endpoint: subscription.endpoint },
      create: {
        patient_id: patientId || null,
        role,
        endpoint:   subscription.endpoint,
        keys_json:  JSON.stringify(subscription.keys),
      },
      update: {
        patient_id: patientId || null,
        role,
        keys_json:  JSON.stringify(subscription.keys),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Push subscribe failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Push unsubscribe failed' }, { status: 500 });
  }
}
