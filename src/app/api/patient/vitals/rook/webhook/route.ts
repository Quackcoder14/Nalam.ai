import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Rook sends POST with no auth header — just respond 200 on success
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Rook webhook payload structure — can contain multiple event types
    // We look for body health / vitals data
    const { user_id, data_source, event_type, body_health, physical_health } = body;

    // Accept any user_id-like field Rook sends
    const patientId = user_id || body.patient_id || body.userId;

    if (!patientId) {
      // Still respond 200 — we don't want Rook to retry indefinitely
      console.warn('Rook webhook: Missing user_id in payload', JSON.stringify(body).substring(0, 200));
      return NextResponse.json({ success: true, message: 'No user_id — ignored' });
    }

    // Parse vitals from body health summary
    const summaries = body_health?.summaries || body_health?.body_health_data || [];
    const physSummaries = physical_health?.summaries || physical_health?.physical_health_data || [];
    
    // Also handle flat vitals (some Rook events send directly on root)
    const flatVitals = {
      hr:   body.heart_rate        ?? body.avg_hr         ?? null,
      spo2: body.spo2              ?? body.blood_oxygen    ?? null,
      resp: body.respiratory_rate  ?? body.resp_rate       ?? null,
      temp: body.temperature       ?? body.skin_temp       ?? null,
      sys:  body.systolic_bp       ?? body.systolic        ?? null,
      dia:  body.diastolic_bp      ?? body.diastolic       ?? null,
    };

    const vitalsToStore: Array<{
      patient_id: string;
      hr: number | null;
      spo2: number | null;
      resp: number | null;
      temp: number | null;
      sys: number | null;
      dia: number | null;
      steps: number | null;
      calories: number | null;
      data_source: string | null;
      recorded_at: Date;
    }> = [];

    // Parse structured summaries from body_health
    for (const s of [...summaries, ...physSummaries]) {
      const recorded = s.date ? new Date(s.date) : new Date();
      vitalsToStore.push({
        patient_id:  patientId,
        hr:          s.heart_rate_data?.avg_hr_bpm           ?? s.avg_hr        ?? null,
        spo2:        s.blood_oxygen_data?.avg_saturation_percentage ?? s.avg_spo2 ?? null,
        resp:        s.respiration_data?.avg_breaths_per_min  ?? null,
        temp:        s.temperature_data?.avg_skin_temp_celsius ?? null,
        sys:         s.blood_pressure_data?.systolic_bp       ?? null,
        dia:         s.blood_pressure_data?.diastolic_bp      ?? null,
        steps:       s.steps_data?.steps                      ?? s.steps        ?? null,
        calories:    s.calories_data?.net_activity_calories   ?? s.calories     ?? null,
        data_source: data_source || s.data_source             || null,
        recorded_at: recorded,
      });
    }

    // If no structured summaries but flat vitals exist, store them
    if (vitalsToStore.length === 0 && Object.values(flatVitals).some(v => v !== null)) {
      vitalsToStore.push({
        patient_id:  patientId,
        hr:          flatVitals.hr   !== null ? Math.round(flatVitals.hr)   : null,
        spo2:        flatVitals.spo2 !== null ? Math.round(flatVitals.spo2) : null,
        resp:        flatVitals.resp !== null ? Math.round(flatVitals.resp) : null,
        temp:        flatVitals.temp ?? null,
        sys:         flatVitals.sys  !== null ? Math.round(flatVitals.sys)  : null,
        dia:         flatVitals.dia  !== null ? Math.round(flatVitals.dia)  : null,
        steps:       body.steps    ?? null,
        calories:    body.calories ?? null,
        data_source: data_source   || null,
        recorded_at: new Date(),
      });
    }

    if (vitalsToStore.length > 0) {
      await prisma.rookVitals.createMany({ data: vitalsToStore });
      console.log(`Rook webhook: Stored ${vitalsToStore.length} vitals record(s) for patient ${patientId}`);
    } else {
      console.log('Rook webhook: Received payload but no vitals data to store. Event type:', event_type);
    }

    // Must respond 200/201/202
    return NextResponse.json({ success: true, stored: vitalsToStore.length }, { status: 200 });
  } catch (error) {
    console.error('Rook webhook error:', error);
    // Still return 200 to prevent Rook from retrying
    return NextResponse.json({ success: true, error: 'Parse error — logged' }, { status: 200 });
  }
}
