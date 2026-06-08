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
  } catch (error: any) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
