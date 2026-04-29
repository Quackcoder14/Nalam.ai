import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ML_SERVICE = 'http://localhost:8001';

// ─── Feature Extraction ───────────────────────────────────────────────────────
function extractClinicalFeatures(patient: any, records: any[]) {
  let systolic = 130, diastolic = 85, hba1c = 5.7, egfr = 90, weightChange = 0;
  const dob = new Date(patient.dob);
  const age = new Date().getFullYear() - dob.getFullYear();

  for (const r of records) {
    if (r.lab_results) {
      const bp = r.lab_results.match(/BP[:\s]*(\d+)\/(\d+)/i);
      if (bp) { systolic = parseInt(bp[1]); diastolic = parseInt(bp[2]); }
      const ha = r.lab_results.match(/HbA1c[:\s]*([\d.]+)/i);
      if (ha) hba1c = parseFloat(ha[1]);
      const eg = r.lab_results.match(/eGFR[:\s]*(\d+)/i);
      if (eg) egfr = parseInt(eg[1]);
    }
    if (r.notes) {
      const wt = r.notes.match(/(\d+)\s*kg/i);
      if (wt) weightChange = parseInt(wt[1]);
    }
  }
  return { age, systolic, diastolic, hba1c, egfr, weightChange, numMeds: records.length };
}

export async function POST(request: Request) {
  const glassBox: any[] = [];
  const { patient, records } = await request.json();

  // Step 1: Feature Extraction
  const t1 = Date.now();
  const features = extractClinicalFeatures(patient, records);
  glassBox.push({
    step: 1,
    agentName: 'Feature Extraction Agent',
    model: 'Rule-Based Clinical Parser',
    inputSummary: { patientId: patient.id, recordCount: records.length },
    output: features,
    durationMs: Date.now() - t1,
    status: 'success',
    timestamp: new Date().toISOString(),
  });

  // Step 2: Groq Narrative Synthesis
  const t2 = Date.now();
  const prompt = `
    You are an expert Clinical Biographer Agent. Synthesize the following patient's longitudinal medical history into a concise 100-200 word executive summary for a clinician.
    Focus on critical risk signals, treatment-response patterns, and actionable insights. Use a highly professional clinical tone.

    Patient Information:
    Name: ${patient.name}
    DOB: ${patient.dob}
    Gender: ${patient.gender}
    Extracted Vitals: Systolic ${features.systolic}mmHg, HbA1c ${features.hba1c}%, eGFR ${features.egfr}

    Longitudinal Records:
    ${JSON.stringify(records, null, 2)}

    Generate the clinical summary:
  `;

  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    max_tokens: 512,
  });

  const text = chatCompletion.choices[0]?.message?.content ?? '';
  glassBox.push({
    step: 2,
    agentName: 'Narrative Synthesis Agent',
    model: 'llama-3.3-70b-versatile (Groq)',
    inputSummary: {
      promptTokens: prompt.split(' ').length,
      patientName: patient.name,
      vitals: { systolic: features.systolic, hba1c: features.hba1c, egfr: features.egfr },
    },
    output: { summaryLength: text.length, preview: text.substring(0, 120) + '...' },
    durationMs: Date.now() - t2,
    status: 'success',
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ summary: text, glassBox });
}
