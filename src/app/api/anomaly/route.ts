import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Groq from 'groq-sdk';

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8005';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
    const lang = body.lang || 'en';
    // Accept patient_id from the request body so alerts are linked to the correct patient
    const patientId: string = body.patientId || body.patient_id || 'unknown';
    
    // Remove meta fields from body sent to ML service
    const mlBody = { ...body };
    delete mlBody.lang;
    delete mlBody.patientId;

    const res = await fetch(`${ML_URL}/anomaly/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mlBody),
      signal: AbortSignal.timeout(5000), // 5-second timeout
    });
    
    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown error');
      console.warn('Anomaly service error %d: %s', res.status, err);
      return NextResponse.json({ ...OFFLINE_FALLBACK, ml_error: err });
    }
    const data = await res.json();
    
    // Normalise flag shape
    if (Array.isArray(data.flags)) {
      data.flags = data.flags.map((f: Record<string, unknown>) => ({
        ...f,
        message: f.message ?? `${f.label}: ${f.vital} = ${f.value} (threshold ${f.operator} ${f.threshold})`,
      }));
    }

    // Use const since these values are not reassigned
    const dbTitle = data.severity === 'critical' ? '🚨 Critical Vital Anomaly' : '⚠️ Vital Anomaly Detected';
    const dbMessage = data.flags?.[0]?.message || 'An anomaly was detected in your vitals.';

    if (lang === 'ta' && Array.isArray(data.flags) && data.flags.length > 0) {
      try {
        const prompt = `Translate this medical alert to Tamil: "${data.flags[0].message}". Return ONLY the translated string, no quotes.`;
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 100,
        });
        const taMsg = completion.choices[0]?.message?.content?.trim();
        if (taMsg) {
          data.flags[0].message = taMsg; // mutate only the response payload
        }
      } catch (e) { console.error('Groq alert translation failed', e); }
    }

    if (data.is_anomaly && (data.severity === 'critical' || data.severity === 'warning')) {
      try {
        await prisma.clinicalAlert.create({
          data: {
            // Use the actual patient ID from the request instead of hardcoded 'P001'
            patient_id: patientId,
            severity: data.severity,
            title: dbTitle,   // always English in DB
            message: dbMessage, // always English in DB
          }
        });
      } catch (e) {
        console.error('Failed to log clinical alert:', e);
      }
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'ML service unavailable';
    console.warn('Anomaly service unavailable:', msg);
    return NextResponse.json(OFFLINE_FALLBACK);
  }
}
