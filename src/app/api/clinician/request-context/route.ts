import { NextResponse } from 'next/server';
import { getPatientById, getMedicalRecords } from '@/lib/data';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const translateCache = new Map<string, any[]>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const contextType = searchParams.get('contextType') || 'unknown'; // e.g., 'emergency', 'specialist'
  const clinician = searchParams.get('clinician') || 'Clinician Portal';
  const lang = searchParams.get('lang') || 'en';

  if (!id) {
    return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
  }

  const patient = await getPatientById(id);
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  // Check Self-Sovereign Identity Consent Rules
  let hasConsent = false;
  if (contextType === 'specialist' && patient.consent_specialist === 'true') hasConsent = true;
  if (contextType === 'emergency' && patient.consent_emergency === 'true') hasConsent = true;
  if (contextType === 'research' && patient.consent_research === 'true') hasConsent = true;

  if (!hasConsent) {
    return NextResponse.json({ error: `Access Denied: Patient has not granted ${contextType} access.` }, { status: 403 });
  }

  // If consent granted, write to the audit log (fire-and-forget)
  const baseUrl = new URL(request.url).origin;
  fetch(`${baseUrl}/api/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: id,
      clinician,
      reason: `${contextType.charAt(0).toUpperCase() + contextType.slice(1)} Context Request`,
    }),
  }).catch(() => {}); // Non-blocking

  // If consent is granted, "decrypt" and return the records
  let records = await getMedicalRecords(id);

  if (lang === 'ta' && records.length > 0) {
    const cacheKey = `${id}_${records.length}`;
    if (translateCache.has(cacheKey)) {
      records = translateCache.get(cacheKey)!;
    } else {
      const prompt = `Translate the following JSON array of medical records into Tamil (தமிழ்). 
Keep the JSON structure exactly the same, including the keys 'record_id', 'date', 'type', 'provider', 'diagnosis', 'notes', and 'lab_results'. 
Only translate the VALUES of 'type', 'provider', 'diagnosis', 'notes', and 'lab_results'.

JSON:
${JSON.stringify(records, null, 2)}`;

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a medical translator. Always respond with raw valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      });

      const raw = completion.choices[0]?.message?.content ?? '[]';
      try {
        const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
        records = JSON.parse(cleaned);
        translateCache.set(cacheKey, records);
      } catch (e) {
        console.error("Translation JSON parse failed", e);
      }
    }
  }

  return NextResponse.json({ 
    success: true, 
    data: { patient, records } 
  });
}
