import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ROOK_CLIENT_UUID = process.env.NEXT_PUBLIC_ROOK_CLIENT_UUID;
const ROOK_SECRET_KEY  = process.env.NEXT_PUBLIC_ROOK_SECRET_KEY;
const ROOK_BASE        = 'https://api.rook-connect.review';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 });
    }

    // 1. Try latest row from our own database (stored by webhook — fastest path)
    const latest = await prisma.rookVitals.findFirst({
      where:   { patient_id: patientId },
      orderBy: { recorded_at: 'desc' },
    });

    if (latest) {
      return NextResponse.json({
        success:     true,
        source:      'rook_webhook',
        data_source: latest.data_source,
        recorded_at: latest.recorded_at,
        steps:       latest.steps,
        calories:    latest.calories,
        vitals: {
          hr:   latest.hr   ?? 72,
          spo2: latest.spo2 ?? 98,
          resp: latest.resp ?? 16,
          temp: latest.temp ?? 36.6,
          sys:  latest.sys  ?? 120,
          dia:  latest.dia  ?? 80,
        },
      });
    }

    // 2. Fallback: Pull today's summary directly from Rook V2 REST API
    if (ROOK_CLIENT_UUID && ROOK_SECRET_KEY) {
      try {
        const token = Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_SECRET_KEY}`).toString('base64');
        const today = new Date().toISOString().split('T')[0];

        // Try body health summary first
        const bodyRes = await fetch(
          `${ROOK_BASE}/v2/processed_data/body_health/summary?user_id=${patientId}&date=${today}`,
          {
            headers: {
              'Authorization': `Basic ${token}`,
              'Accept':        'application/json',
              'User-Agent':    'Mozilla/5.0',
            },
          }
        );

        if (bodyRes.ok) {
          const bodyData = await bodyRes.json();
          const s = bodyData.body_health?.summary;
          if (s) {
            const vitals = {
              hr:   s.heart_rate_data?.avg_hr_bpm                  ?? s.avg_hr_bpm                  ?? null,
              spo2: s.blood_oxygen_data?.avg_saturation_percentage  ?? s.avg_saturation_percentage   ?? null,
              resp: s.respiration_data?.avg_breaths_per_min         ?? null,
              temp: s.temperature_data?.avg_skin_temp_celsius        ?? null,
              sys:  s.blood_pressure_data?.systolic_bp_mmhg         ?? s.systolic_blood_pressure_mmhg ?? null,
              dia:  s.blood_pressure_data?.diastolic_bp_mmhg        ?? s.diastolic_blood_pressure_mmhg ?? null,
            };
            if (Object.values(vitals).some(v => v !== null)) {
              return NextResponse.json({
                success: true,
                source:  'rook_api',
                vitals: {
                  hr:   vitals.hr   ?? 72,
                  spo2: vitals.spo2 ?? 98,
                  resp: vitals.resp ?? 16,
                  temp: vitals.temp ?? 36.6,
                  sys:  vitals.sys  ?? 120,
                  dia:  vitals.dia  ?? 80,
                },
              });
            }
          }
        }

        // Also try physical health summary for heart rate / oxygenation
        const physRes = await fetch(
          `${ROOK_BASE}/v2/processed_data/physical_health/summary?user_id=${patientId}&date=${today}`,
          {
            headers: {
              'Authorization': `Basic ${token}`,
              'Accept':        'application/json',
              'User-Agent':    'Mozilla/5.0',
            },
          }
        );

        if (physRes.ok) {
          const physData = await physRes.json();
          const s = physData.physical_health?.summary;
          if (s) {
            const vitals = {
              hr:   s.heart_rate_data?.avg_hr_bpm                 ?? null,
              spo2: s.oxygenation_data?.avg_saturation_percentage ?? null,
              resp: null as number | null,
              temp: null as number | null,
              sys:  null as number | null,
              dia:  null as number | null,
            };
            if (Object.values(vitals).some(v => v !== null)) {
              return NextResponse.json({
                success: true,
                source:  'rook_api_physical',
                vitals: {
                  hr:   vitals.hr   ?? 72,
                  spo2: vitals.spo2 ?? 98,
                  resp: 16,
                  temp: 36.6,
                  sys:  120,
                  dia:  80,
                },
              });
            }
          }
        }
      } catch (e) {
        console.warn('Rook REST API fallback failed:', e);
      }
    }

    // 3. No data yet — inform the frontend
    return NextResponse.json({
      success: true,
      source:  'no_data',
      vitals:  null,
      message: 'No vitals data received yet. Make sure your device is syncing with the Rook-connected app.',
    });
  } catch (error) {
    console.error('Rook vitals fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch vitals' }, { status: 500 });
  }
}
