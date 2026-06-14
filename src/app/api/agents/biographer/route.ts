/**
 * /api/agents/biographer
 * Proxies to the Python LangGraph context_graph:
 *   guardrails → retriever → biographer
 * The graph enforces consent, limits data exposure, and uses
 * ChromaDB vector search before calling Groq for synthesis.
 */
import { NextResponse } from 'next/server';

const ML_SERVICE = process.env.ML_SERVICE_URL ?? 'http://localhost:8005';

export async function POST(request: Request) {
  const { patient, records, role = 'specialist', lang = 'en' } = await request.json();

  if (!patient?.id) {
    return NextResponse.json({ error: 'patient.id is required.' }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    const res = await fetch(`${ML_SERVICE}/graph/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patient.id,
        role: role,
        lang: lang,
        patient,
        records,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `ML service error: ${err}` }, { status: 502 });
    }

    const data = await res.json();

    // Build glassBox entries from guardrail_log for the Glass Box UI
    const glassBox = [
      {
        step: 1,
        agentName: lang === 'ta' ? 'பாதுகாப்பு ஏஜென்ட்' : 'Guardrails Agent',
        model: 'Consent + Role-Based Data Filter',
        inputSummary: { patientId: patient.id, role: role, recordsAvailable: records.length },
        output: data.guardrail_log ?? [],
        durationMs: 0,
        status: data.errors?.length ? 'error' : 'success',
        timestamp: new Date().toISOString(),
      },
      {
        step: 2,
        agentName: lang === 'ta' ? 'மீட்டெடுப்பு ஏஜென்ட் (ChromaDB)' : 'Retriever Agent (ChromaDB)',
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputSummary: { recordsShared: data.records_shared },
        output: { contextChunks: data.context_chunks },
        durationMs: 0,
        status: 'success',
        timestamp: new Date().toISOString(),
      },
      {
        step: 3,
        agentName: lang === 'ta' ? 'வாழ்க்கை வரலாறு ஏஜென்ட்' : 'Biographer Agent',
        model: 'llama-3.3-70b-versatile (Groq)',
        inputSummary: { contextChunks: data.context_chunks, recordsUsed: data.records_shared },
        output: { summaryLength: data.biography?.length ?? 0, preview: data.biography?.substring(0, 120) + '...' },
        durationMs: data.duration_ms,
        status: data.biography ? 'success' : 'error',
        timestamp: new Date().toISOString(),
      },
    ];

    // Translate biography if Tamil requested but ML service may have returned English
    let biography = data.biography ?? '';
    if (lang === 'ta' && biography.length > 0) {
      // Detect if text is mostly Latin (not already in Tamil)
      const latinChars = (biography.match(/[a-zA-Z]/g) || []).length;
      const totalChars = biography.replace(/\s/g, '').length;
      if (latinChars / totalChars > 0.4) {
        try {
          const Groq = (await import('groq-sdk')).default;
          const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
          const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are a medical translator. Translate the given patient biography into Tamil (தமிழ்). Keep medical terms transliterated if needed. Output only the translated text.' },
              { role: 'user', content: biography },
            ],
            temperature: 0.2,
            max_tokens: 600,
          });
          biography = completion.choices[0]?.message?.content?.trim() ?? biography;
        } catch { /* keep original on failure */ }
      }
    }

    return NextResponse.json({ summary: biography, glassBox });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
