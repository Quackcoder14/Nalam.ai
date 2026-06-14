/**
 * /api/agents/twin
 * Proxies to the Python LangGraph simulation_graph.
 * Post-processes output with Groq to ensure consistent length and full translation.
 */
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const ML_SERVICE = process.env.ML_SERVICE_URL ?? 'http://localhost:8005';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const langLabel = (lang: string) => lang === 'ta' ? 'Tamil (தமிழ்)' : 'English';

async function normalizeSimText(raw: string, field: string, lang: string): Promise<string> {
  if (!raw || raw.trim().length === 0) return '';
  const prompt = `You are a clinical documentation specialist.
Rewrite the following "${field}" text as exactly 3-4 concise clinical sentences in ${langLabel(lang)}.
- Use clear, professional medical language suitable for a doctor.
- Do NOT use bullet points, headers, or markdown.
- The output must be entirely in ${langLabel(lang)} — no mixing of languages.
- Keep it under 120 words.

Text to rewrite:
"${raw}"

Output only the rewritten text, nothing else.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 250,
  });
  return completion.choices[0]?.message?.content?.trim() ?? raw;
}

export async function POST(request: Request) {
  const { patient, records, intervention, role = 'specialist', lang = 'en' } = await request.json();

  if (!patient?.id) {
    return NextResponse.json({ error: 'patient.id is required.' }, { status: 400 });
  }
  if (!intervention) {
    return NextResponse.json({ error: 'Intervention parameter is required.' }, { status: 400 });
  }

  try {
    const res = await fetch(`${ML_SERVICE}/graph/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patient.id,
        role,
        lang,
        patient,
        records,
        intervention,
        regional_context: {
          region: 'Tamil Nadu, India',
          endemic_risks: [
            'Type-2 Diabetes (prevalence ~15%, highest in urban TN)',
            'Hypertension (uncontrolled, especially in rural areas)',
            'Dengue fever (seasonal, post-monsoon surge)',
            'Chikungunya (endemic, recurring outbreaks)',
            'Chronic Kidney Disease (associated with T2DM+HTN)',
          ],
          healthcare_context: [
            'TNMSC generic formulary preferred (Metformin IP, Amlodipine IP, etc.)',
            'High prevalence of undiagnosed hypertension in 40-60 age group',
            'Dengue-related thrombocytopenia requires aggressive monitoring',
            'Family history of T2DM should elevate glycaemic risk scores',
          ],
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `ML service error: ${err}` }, { status: 502 });
    }

    const data = await res.json();

    // Normalize all three text fields: consistent length + full translation
    const [treatmentDecision, riskPrediction, personalizedCare] = await Promise.all([
      normalizeSimText(data.treatmentDecision ?? '', 'Treatment Decision', lang),
      normalizeSimText(data.riskPrediction ?? '', 'Risk Prediction', lang),
      normalizeSimText(data.personalizedCare ?? '', 'Personalized Care', lang),
    ]);

    const glassBox = [
      {
        step: 1,
        agentName: lang === 'ta' ? 'பாதுகாப்பு ஏஜென்ட்' : 'Guardrails Agent',
        model: 'Consent + Role-Based Data Filter',
        inputSummary: { patientId: patient.id, role },
        output: data.guardrail_log ?? [],
        durationMs: 0,
        status: data.errors?.length ? 'error' : 'success',
        timestamp: new Date().toISOString(),
      },
      {
        step: 2,
        agentName: lang === 'ta' ? 'மீட்டெடுப்பு ஏஜென்ட் (ChromaDB)' : 'Retriever Agent (ChromaDB)',
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputSummary: { intervention },
        output: { contextRetrieved: true },
        durationMs: 0,
        status: 'success',
        timestamp: new Date().toISOString(),
      },
      {
        step: 3,
        agentName: lang === 'ta' ? 'டிஜிட்டல் இரட்டை ஏஜென்ட்' : 'Digital Twin Agent',
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
      treatmentDecision,
      riskPrediction,
      personalizedCare,
      bpTrajectory:      data.bp_trajectory ?? [],
      effectivenessProb: data.effectiveness_probability ?? 0,
      glassBox,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
