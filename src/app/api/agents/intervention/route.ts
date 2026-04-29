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

  // Step 2: Python ML Risk Classification
  let mlResult: any = null;
  const t2 = Date.now();
  try {
    const mlRes = await fetch(`${ML_SERVICE}/predict/risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        age: features.age,
        systolic: features.systolic,
        diastolic: features.diastolic,
        hba1c: features.hba1c,
        egfr: features.egfr,
        weight_change: features.weightChange,
        num_meds: features.numMeds,
      }),
    });
    mlResult = await mlRes.json();
    glassBox.push({
      step: 2,
      agentName: 'Risk Classifier Agent',
      model: `sklearn ${mlResult.model} (n_estimators=${mlResult.nEstimators})`,
      inputSummary: mlResult.featuresUsed,
      output: {
        riskLevel: mlResult.riskLevel,
        confidence: (mlResult.riskScore * 100).toFixed(1) + '%',
        probabilities: mlResult.probabilities,
        trainingAccuracy: mlResult.trainingAccuracy,
      },
      durationMs: mlResult.inferenceMs,
      status: 'success',
      timestamp: new Date().toISOString(),
    });
  } catch {
    glassBox.push({
      step: 2,
      agentName: 'Risk Classifier Agent',
      model: 'sklearn GradientBoostingClassifier',
      inputSummary: features,
      output: 'ML service unavailable — Groq will infer risk level',
      durationMs: Date.now() - t2,
      status: 'skipped',
      timestamp: new Date().toISOString(),
    });
  }

  // Step 3: Groq narrative generation
  const t3 = Date.now();
  const riskContext = mlResult
    ? `The ML Risk Classifier has determined riskLevel="${mlResult.riskLevel}" with ${(mlResult.riskScore * 100).toFixed(0)}% confidence (probabilities: Low=${mlResult.probabilities.Low}, Medium=${mlResult.probabilities.Medium}, High=${mlResult.probabilities.High}).`
    : '';

  const prompt = `
    You are the Early Warning & Intervention Engine for Sentinel-Health.
    ${riskContext}
    
    Analyze the following patient data and return a JSON object.

    Patient: ${patient.name}, DOB: ${patient.dob}, Gender: ${patient.gender}
    Extracted Vitals: Systolic ${features.systolic}mmHg, Diastolic ${features.diastolic}mmHg, HbA1c ${features.hba1c}%, eGFR ${features.egfr}
    Medical History: ${JSON.stringify(records, null, 2)}

    Return a JSON object with exactly:
    - "riskLevel": ${mlResult ? `"${mlResult.riskLevel}" (confirmed by ML model)` : '"Low", "Medium", or "High"'}
    - "detectedPattern": 1-2 sentence description of the detected physiological drift
    - "suggestedIntervention": 3-5 word title for the recommended intervention
    - "actionPlan": 1-2 sentence detailed preventative action plan
  `;

  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.4,
    max_tokens: 512,
    response_format: { type: 'json_object' },
  });

  const resultText = chatCompletion.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(resultText);

  // If ML gave us a confirmed riskLevel, override the LLM's answer
  if (mlResult) parsed.riskLevel = mlResult.riskLevel;

  glassBox.push({
    step: 3,
    agentName: 'Intervention Narrative Agent',
    model: 'llama-3.3-70b-versatile (Groq)',
    inputSummary: {
      mlRiskLevel: mlResult?.riskLevel ?? 'N/A (ML skipped)',
      vitals: { systolic: features.systolic, hba1c: features.hba1c, egfr: features.egfr },
    },
    output: { riskLevel: parsed.riskLevel, suggestedIntervention: parsed.suggestedIntervention },
    durationMs: Date.now() - t3,
    status: 'success',
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ ...parsed, glassBox });
}
