/**
 * /api/agents/twin
 * Proxies to the Python LangGraph simulation_graph:
 *   guardrails → retriever → twin
 * Uses sklearn RF model for effectiveness prediction and Groq for
 * precision medicine narrative. ChromaDB provides similar patient context.
 */
import { NextResponse } from 'next/server';

const ML_SERVICE = process.env.ML_SERVICE_URL ?? 'http://localhost:8005';

export async function POST(request: Request) {
  const { patient, records, intervention } = await request.json();

  if (!patient?.id) {
    return NextResponse.json({ error: 'patient.id is required.' }, { status: 400 });
  }
  if (!intervention) {
    return NextResponse.json({ error: 'Intervention parameter is required.' }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    const res = await fetch(`${ML_SERVICE}/graph/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patient.id,
        role: 'specialist',
        patient,
        records,
        intervention,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `ML service error: ${err}` }, { status: 502 });
    }

    const data = await res.json();

    const glassBox = [
      {
        step: 1,
        agentName: 'Guardrails Agent',
        model: 'Consent + Role-Based Data Filter',
        inputSummary: { patientId: patient.id, role: 'specialist' },
        output: data.guardrail_log ?? [],
        durationMs: 0,
        status: data.errors?.length ? 'error' : 'success',
        timestamp: new Date().toISOString(),
      },
      {
        step: 2,
        agentName: 'Retriever Agent (ChromaDB)',
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputSummary: { intervention },
        output: { contextRetrieved: true },
        durationMs: 0,
        status: 'success',
        timestamp: new Date().toISOString(),
      },
      {
        step: 3,
        agentName: 'Digital Twin Agent',
        model: 'sklearn RandomForest + llama-3.3-70b-versatile',
        inputSummary: { intervention },
        output: {
          effectiveness: `${((data.effectiveness_probability ?? 0) * 100).toFixed(0)}%`,
          bpTrajectory: data.bp_trajectory,
        },
        durationMs: data.duration_ms,
        status: data.treatmentDecision ? 'success' : 'error',
        timestamp: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      treatmentDecision: data.treatmentDecision ?? '',
      riskPrediction:    data.riskPrediction ?? '',
      personalizedCare:  data.personalizedCare ?? '',
      bpTrajectory:      data.bp_trajectory ?? [],
      effectivenessProb: data.effectiveness_probability ?? 0,
      glassBox,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
