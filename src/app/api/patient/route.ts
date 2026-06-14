import { NextResponse } from 'next/server';
import { getPatientById, getMedicalRecords, getAllPatients } from '@/lib/data';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Quick translation cache to avoid hitting Groq repeatedly for identical seeded records
const translateCache = new Map<string, any[]>();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const lang = searchParams.get('lang') || 'en';

    if (!id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    if (id === 'ALL') {
      const patients = await getAllPatients();
      return NextResponse.json({ patients });
    }

    const patient = await getPatientById(id);
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    let records = await getMedicalRecords(id);

    // On-the-fly translation to Tamil if requested
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

    return NextResponse.json({ patient, records });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
