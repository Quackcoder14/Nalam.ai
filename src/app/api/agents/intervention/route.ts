/**
 * /api/agents/intervention
 * Proxies to the Python LangGraph intervention_graph:
 *   guardrails → retriever → intervention
 * Enforces consent, limits data, runs semantic retrieval from ChromaDB,
 * then computes risk score + Groq action plan.
 */
import { NextResponse } from 'next/server';

const ML_SERVICE = process.env.ML_SERVICE_URL ?? 'http://localhost:8005';

export async function POST(request: Request) {
  const { patient, records } = await request.json();

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
        output: { contextRetrieved: true },
        durationMs: 0,
        status: 'success',
        timestamp: new Date().toISOString(),
      },
      {
        step: 3,
        agentName: 'Intervention Agent',
        model: 'Rule-Based Risk Scorer + llama-3.3-70b-versatile',
        inputSummary: { recordsShared: data.records_shared },
        output: { riskLevel: result.riskLevel, score: result.risk_score },
        durationMs: data.duration_ms,
        status: result.riskLevel ? 'success' : 'error',
        timestamp: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      riskLevel:        result.riskLevel       ?? 'Unknown',
      detectedPattern:  result.detectedPattern  ?? '',
      actionPlan:       result.actionPlan       ?? '',
      glassBox,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
