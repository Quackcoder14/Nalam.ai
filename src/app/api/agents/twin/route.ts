import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ML_SERVICE = 'http://localhost:8001';

function extractClinicalFeatures(patient: any, records: any[]) {
  let systolic = 130, diastolic = 85, hba1c = 5.7, egfr = 90, weightChange = 0;
  const age = new Date().getFullYear() - new Date(patient.dob).getFullYear();
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
  return { age, systolic, diastolic, hba1c, egfr, weightChange };
}

function isCombination(name: string): boolean {
  return /\+|and|combo|dual|tri/i.test(name) || name.trim().split(' ').length > 3;
}

export async function POST(request: Request) {
  const glassBox: any[] = [];
  const { patient, records, intervention } = await request.json();

  if (!intervention) {
    return NextResponse.json({ error: 'Intervention parameter is required.' }, { status: 400 });
  }

  // Step 1: Feature Extraction
  const t1 = Date.now();
  const features = extractClinicalFeatures(patient, records);
  glassBox.push({
    step: 1,
    agentName: 'Feature Extraction Agent',
    model: 'Rule-Based Clinical Parser',
    inputSummary: { patientId: patient.id, recordCount: records.length, intervention },
    output: features,
    durationMs: Date.now() - t1,
    status: 'success',
    timestamp: new Date().toISOString(),
  });

  // Step 2: Python ML — Medication Effectiveness Prediction
  let mlResult: any = null;
  const t2 = Date.now();
  try {
    const mlRes = await fetch(`${ML_SERVICE}/predict/medication-effectiveness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseline_systolic: features.systolic,
        hba1c: features.hba1c,
        egfr: features.egfr,
        age: features.age,
        medication_name: intervention,
        is_combination: isCombination(intervention),
      }),
    });
    mlResult = await mlRes.json();
    glassBox.push({
      step: 2,
      agentName: 'Medication Effectiveness Agent',
      model: `sklearn ${mlResult.model} (n_estimators=${mlResult.nEstimators})`,
      inputSummary: mlResult.featuresUsed,
      output: {
        medicationClass: mlResult.medicationClass,
        predictedSystolicReduction: `${mlResult.predictedSystolicReduction} mmHg`,
        predictedSystolicAfter: `${mlResult.predictedSystolicAfter} mmHg`,
        isCombinationTherapy: mlResult.isCombinationTherapy,
      },
      durationMs: mlResult.inferenceMs,
      status: 'success',
      timestamp: new Date().toISOString(),
    });
  } catch {
    glassBox.push({
      step: 2,
      agentName: 'Medication Effectiveness Agent',
      model: 'sklearn GradientBoostingRegressor',
      inputSummary: { medication: intervention, baseline_systolic: features.systolic },
      output: 'ML service unavailable — Groq will infer effectiveness',
      durationMs: Date.now() - t2,
      status: 'skipped',
      timestamp: new Date().toISOString(),
    });
  }

  // Step 3: Groq Precision Medicine Narrative
  const t3 = Date.now();
  const mlContext = mlResult
    ? `A validated GradientBoostingRegressor model predicts that "${intervention}" (class: ${mlResult.medicationClass}) will reduce systolic BP by approximately ${mlResult.predictedSystolicReduction} mmHg, from ${features.systolic} to ${mlResult.predictedSystolicAfter} mmHg. Combination therapy: ${mlResult.isCombinationTherapy}.`
    : '';

  const prompt = `
    You are the Twin-Simulator Agent — an advanced predictive precision medicine AI.
    ${mlContext}

    Patient: ${patient.name}, DOB: ${patient.dob}, Gender: ${patient.gender}
    Extracted Vitals: Systolic ${features.systolic}mmHg, Diastolic ${features.diastolic}mmHg, HbA1c ${features.hba1c}%, eGFR ${features.egfr}
    Medical History: ${JSON.stringify(records, null, 2)}
    Proposed Intervention: "${intervention}"

    Using the ML model's prediction as ground truth where available, return a JSON with exactly:
    - "treatmentDecision": comparative effectiveness insight referencing cohort matching data and the ML-predicted BP reduction
    - "riskPrediction": specific risk timeline or complication insight for this patient profile
    - "personalizedCare": rationale for this precision medicine approach over a generic protocol
  `;

  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.5,
    max_tokens: 768,
    response_format: { type: 'json_object' },
  });

  const resultText = chatCompletion.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(resultText);

  glassBox.push({
    step: 3,
    agentName: 'Precision Narrative Agent',
    model: 'llama-3.3-70b-versatile (Groq)',
    inputSummary: {
      intervention,
      mlPredictedReduction: mlResult ? `${mlResult.predictedSystolicReduction} mmHg` : 'N/A',
      vitals: { systolic: features.systolic, hba1c: features.hba1c, egfr: features.egfr },
    },
    output: { treatmentDecisionPreview: parsed.treatmentDecision?.substring(0, 100) + '...' },
    durationMs: Date.now() - t3,
    status: 'success',
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ ...parsed, glassBox });
}
