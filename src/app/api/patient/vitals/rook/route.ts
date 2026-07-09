import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ROOK_CLIENT_UUID = process.env.NEXT_PUBLIC_ROOK_CLIENT_UUID;
const ROOK_SECRET_KEY  = process.env.NEXT_PUBLIC_ROOK_SECRET_KEY;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 });
    }

    // Try to get the latest vitals from the database (stored by the webhook)
    const latest = await prisma.rookVitals.findFirst({
      where:   { patient_id: patientId },
      orderBy: { recorded_at: 'desc' },
    });

    if (latest) {
      return NextResponse.json({
        success: true,
        vitals: {
          hr:   latest.hr   ?? 72,
          spo2: latest.spo2 ?? 98,
          resp: latest.resp ?? 16,
          temp: latest.temp ?? 36.6,
          sys:  latest.sys  ?? 120,
          dia:  latest.dia  ?? 80,
        },
        source:      'rook_live',
        data_source: latest.data_source,
        recorded_at: latest.recorded_at,
        steps:       latest.steps,
        calories:    latest.calories,
      });
    }

    // No data yet in DB — optionally try pulling from Rook REST API
    if (ROOK_CLIENT_UUID && ROOK_SECRET_KEY) {
      try {
        const token = Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_SECRET_KEY}`).toString('base64');
        // Get today's date for summary query
        const today = new Date().toISOString().split('T')[0];
        const rookRes = await fetch(
          `https://api.rook-connect.review/api/v1/user_id/${patientId}/body_health/summary?date=${today}`,
          {
            headers: {
              'Authorization': `Basic ${token}`,
              'Accept':        'application/json',
              'User-Agent':    'Mozilla/5.0',
            },
          }
        );
        if (rookRes.ok) {
          const rookData = await rookRes.json();
          const s = rookData.body_health_summary || rookData.summary || rookData;
          if (s?.heart_rate_data || s?.avg_hr_bpm) {
            return NextResponse.json({
              success: true,
              vitals: {
                hr:   s.heart_rate_data?.avg_hr_bpm            ?? s.avg_hr_bpm ?? 72,
                spo2: s.blood_oxygen_data?.avg_saturation_percentage ?? 98,
                resp: s.respiration_data?.avg_breaths_per_min  ?? 16,
                temp: s.temperature_data?.avg_skin_temp_celsius ?? 36.6,
                sys:  s.blood_pressure_data?.systolic_bp        ?? 120,
                dia:  s.blood_pressure_data?.diastolic_bp       ?? 80,
              },
              source: 'rook_api',
            });
          }
        }
      } catch (e) {
        console.warn('Rook REST fallback failed:', e);
      }
    }

    // Nothing from DB or API yet — return a message so UI can show "Waiting for device data"
    return NextResponse.json({
      success: true,
      vitals:  null,
      source:  'no_data',
      message: 'No vitals data received yet from your device. Make sure your device is syncing.',
    });
  } catch (error) {
    console.error('Rook vitals fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch vitals' }, { status: 500 });
  }
}
