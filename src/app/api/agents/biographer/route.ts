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
  const { patient, records } = await request.json();

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
        role: 'specialist',
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
        agentName: 'Guardrails Agent',
        model: 'Consent + Role-Based Data Filter',
        inputSummary: { patientId: patient.id, role: 'specialist', recordsAvailable: records.length },
        output: data.guardrail_log ?? [],
        durationMs: 0,
        status: data.errors?.length ? 'error' : 'success',
        timestamp: new Date().toISOString(),
      },
      {
        step: 2,
        agentName: 'Retriever Agent (ChromaDB)',
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputSummary: { recordsShared: data.records_shared },
        output: { contextChunks: data.context_chunks },
        durationMs: 0,
        status: 'success',
        timestamp: new Date().toISOString(),
      },
      {
        step: 3,
        agentName: 'Biographer Agent',
        model: 'llama-3.3-70b-versatile (Groq)',
        inputSummary: { contextChunks: data.context_chunks, recordsUsed: data.records_shared },
        output: { summaryLength: data.biography?.length ?? 0, preview: data.biography?.substring(0, 120) + '...' },
        durationMs: data.duration_ms,
        status: data.biography ? 'success' : 'error',
        timestamp: new Date().toISOString(),
      },
    ];

    return NextResponse.json({ summary: data.biography ?? '', glassBox });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
