# Challenge 1 — Longitudinal Health Memory

## Problem Statement

Patients in India visit multiple hospitals and clinics across their lifetime. Their medical history is trapped in disconnected paper records and proprietary EHR systems. Doctors make life-critical decisions without full context; patients cannot easily share their complete history.

## Challenge

Build a system that:
1. Aggregates patient records from multiple simulated EHR sources into a single encrypted vault
2. Provides AI-synthesized clinical summaries from the longitudinal data
3. Enforces patient-controlled, granular consent for data access
4. Generates real-time intervention recommendations based on clinical trends

## Acceptance Criteria

- [ ] Patient vault stores records from at least 2 simulated providers
- [ ] All PII fields encrypted at rest (AES-256-GCM or equivalent)
- [ ] AI-generated biographer summary is clinically coherent and patient-specific
- [ ] Consent toggles persist and are respected by the clinician context API
- [ ] Audit log records every clinician access event with timestamp and reason

## Sample Input

```json
{
  "patient": {
    "id": "P001",
    "name": "Arjun Mehta",
    "dob": "1985-04-12",
    "gender": "Male"
  },
  "records": [
    { "date": "2024-01-15", "diagnosis": "Hypertension Stage 2", "provider": "Apollo Hospital", "lab_results": "BP: 152/95" },
    { "date": "2024-06-10", "diagnosis": "Chronic Kidney Disease Stage 2", "provider": "AIIMS Delhi", "lab_results": "eGFR: 68" }
  ]
}
```

## Expected Output

```json
{
  "summary": "Arjun Mehta is a 40-year-old male with a history of Stage 2 Hypertension and early CKD...",
  "riskLevel": "High",
  "detectedPattern": "Progressive BP elevation with declining renal function",
  "actionPlan": "Intensify antihypertensive therapy; renal protective ACE inhibitor preferred"
}
```

---

# Challenge 2 — Precision Medicine Twin Simulation

## Problem Statement

Clinicians often make medication decisions without quantitative insight into how a specific patient's history and physiology will respond to an intervention.

## Challenge

Build a digital twin simulation that:
1. Takes a patient's longitudinal data and a proposed intervention (medication + dose)
2. Predicts the likely outcome using an ML model (sklearn or equivalent)
3. Generates a precision narrative explaining the decision rationale

## Acceptance Criteria

- [ ] Accepts a medication name and dosage as structured input
- [ ] Returns predicted BP trajectory (3-year projection)
- [ ] Generates at least 3 distinct narrative outputs (treatment decision, risk prediction, personalized care)
- [ ] Handles unknown medications gracefully (fallback to Groq LLM reasoning)

## Sample Input

```json
{
  "patientId": "P001",
  "intervention": "Amlodipine 10mg",
  "contextType": "specialist"
}
```

## Expected Output

```json
{
  "treatmentDecision": "Amlodipine 10mg is appropriate given the patient's BP trend...",
  "riskPrediction": "30% reduction in cardiovascular event probability over 5 years...",
  "personalizedCare": "Monitor for ankle oedema; check renal function at 3 months..."
}
```
