/**
 * /api/agents/intervention
 * Proxies to the Python LangGraph intervention_graph.
 * Translates detectedPattern and actionPlan through Groq when lang='ta'
 * so content is never mixed between English and Tamil.
 */
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const ML_SERVICE = process.env.ML_SERVICE_URL ?? 'http://localhost:8005';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function translateIfNeeded(text: string, lang: string): Promise<string> {
  if (!text || lang !== 'ta') return text;
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are a medical translator. Translate the given clinical text into Tamil (தமிழ்). Keep medical terms transliterated if no standard Tamil equivalent exists. Output only the translated text, nothing else.',
      },
      { role: 'user', content: text },
    ],
    temperature: 0.2,
    max_tokens: 400,
  });
  return completion.choices[0]?.message?.content?.trim() ?? text;
}

export async function POST(request: Request) {
  const { patient, records, lang = 'en' } = await request.json();

  if (!patient?.id) {
    return NextResponse.json({ error: 'patient.id is required.' }, { status: 400 });
  }

  try {
    const res = await fetch(`${ML_SERVICE}/graph/intervention`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patient.id,
        role: 'specialist',
        lang: 'en', // Always request English from ML service to ensure full length
        patient,
        records,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `ML service error: ${err}` }, { status: 502 });
    }

    const data = await res.json();
    const result = data.intervention ?? {};

    // Translate text fields if Tamil is requested
    const [detectedPattern, actionPlan] = await Promise.all([
      translateIfNeeded(result.detectedPattern ?? '', lang),
      translateIfNeeded(result.actionPlan ?? '', lang),
    ]);

    const glassBox = [
      {
        step: 1,
        agentName: lang === 'ta' ? 'பாதுகாப்பு ஏஜென்ட்' : 'Guardrails Agent',
        model: 'Consent + Role-Based Data Filter',
        inputSummary: { patientId: patient.id, role: 'specialist', recordsAvailable: records.length },
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
        output: { contextRetrieved: true },
        durationMs: 0,
        status: 'success',
        timestamp: new Date().toISOString(),
      },
      {
        step: 3,
        agentName: lang === 'ta' ? 'தலையீட்டு ஏஜென்ட்' : 'Intervention Agent',
        model: 'Rule-Based Risk Scorer + llama-3.3-70b-versatile',
        inputSummary: { recordsShared: data.records_shared },
        output: { riskLevel: result.riskLevel, score: result.risk_score },
        durationMs: data.duration_ms,
        status: result.riskLevel ? 'success' : 'error',
        timestamp: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      riskLevel:       result.riskLevel ?? 'Unknown',
      detectedPattern,
      actionPlan,
      glassBox,
    });
  } catch (e: any) {
    const isNetwork = e.message?.includes('fetch') || e.cause?.code === 'ECONNREFUSED';
    const status = isNetwork ? 502 : 500;
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status });
  }
}
