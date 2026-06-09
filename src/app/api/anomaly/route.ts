import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8005';

const OFFLINE_FALLBACK = {
  is_anomaly: false,
  score: 0,
  severity: 'normal',
  flags: [],
  ml_flagged: false,
  offline: true,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${ML_URL}/anomaly/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000), // 5-second timeout
    });
    if (!res.ok) {
      // ML service returned an error — log it but return graceful fallback
      const err = await res.text().catch(() => 'unknown error');
      console.warn('Anomaly service error %d: %s', res.status, err);
      return NextResponse.json({ ...OFFLINE_FALLBACK, ml_error: err });
    }
    const data = await res.json();
    // Normalise flag shape: ensure each flag has a .message field
    if (Array.isArray(data.flags)) {
      data.flags = data.flags.map((f: any) => ({
        ...f,
        message: f.message ?? `${f.label}: ${f.vital} = ${f.value} (threshold ${f.operator} ${f.threshold})`,
      }));
    }

    if (data.is_anomaly && (data.severity === 'critical' || data.severity === 'warning')) {
      try {
        await prisma.clinicalAlert.create({
          data: {
            patient_id: 'P001',
            severity: data.severity,
            title: data.severity === 'critical' ? '🚨 Critical Vital Anomaly' : '⚠️ Vital Anomaly Detected',
            message: data.flags?.[0]?.message || 'An anomaly was detected in your vitals.',
          }
        });
      } catch (e) {
        console.error('Failed to log clinical alert:', e);
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    // ML service offline / timeout — return graceful no-anomaly response
    console.warn('Anomaly service unavailable:', error.message);
    return NextResponse.json(OFFLINE_FALLBACK);
  }
}
