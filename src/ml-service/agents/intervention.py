"""
agents/intervention.py
----------------------
Intervention node: extracts clinical features from filtered records,
scores risk numerically, then uses Groq to generate a structured
action plan with detected pattern and risk level.
"""

import os
import logging
import re
from groq import Groq
from .state import NalamState

logger = logging.getLogger(__name__)
_groq = None


def _get_groq() -> Groq:
    global _groq
    if _groq is None:
        _groq = Groq()
    return _groq


def _extract_features(patient: dict, records: list) -> dict:
    """Parse lab values from record text into numeric clinical features."""
    age = 0
    try:
        dob = patient.get("dob", "")
        if dob:
            age = 2024 - int(dob.split("-")[0])
    except Exception:
        age = 50

    systolic, diastolic, hba1c, egfr = 130, 85, 5.7, 90

    for r in records:
        labs = r.get("lab_results", "") or ""
        bp = re.search(r'BP[:\s]*(\d+)/(\d+)', labs, re.I)
        if bp:
            systolic, diastolic = int(bp.group(1)), int(bp.group(2))
        ha = re.search(r'HbA1c[:\s]*([\d.]+)', labs, re.I)
        if ha:
            hba1c = float(ha.group(1))
        eg = re.search(r'eGFR[:\s]*(\d+)', labs, re.I)
        if eg:
            egfr = int(eg.group(1))

    # Simple rule-based risk score
    score = 0
    if systolic >= 160: score += 3
    elif systolic >= 140: score += 2
    elif systolic >= 130: score += 1
    if hba1c >= 8.0: score += 3
    elif hba1c >= 6.5: score += 2
    elif hba1c >= 5.7: score += 1
    if egfr < 45: score += 3
    elif egfr < 60: score += 2
    elif egfr < 75: score += 1
    if age > 65: score += 1

    risk_level = "High" if score >= 6 else "Medium" if score >= 3 else "Low"
    return {"age": age, "systolic": systolic, "diastolic": diastolic,
            "hba1c": hba1c, "egfr": egfr, "risk_score": score, "risk_level": risk_level}


def intervention_node(state: NalamState) -> NalamState:
    if state.get("guardrail_denied"):
        return {**state, "intervention_result": {"error": "Access denied by guardrails."}}

    patient  = state.get("patient_filtered", state.get("patient_raw", {}))
    records  = state.get("records_filtered", [])
    context  = state.get("retrieved_context", [])

    features = _extract_features(patient, records)

    records_summary = "\n".join([
        f"  [{r.get('date','')}] {r.get('diagnosis','')} | {r.get('lab_results','')}"
        for r in records
    ]) or "No records."
    context_text = "\n".join([f"  • {c}" for c in context[:3]]) if context else "None."

    prompt = f"""You are a clinical AI specialising in preventive cardiology and chronic disease management.

Patient features:
  Age: {features['age']} | BP: {features['systolic']}/{features['diastolic']} mmHg
  HbA1c: {features['hba1c']}% | eGFR: {features['egfr']} ml/min/1.73m²
  Computed Risk Score: {features['risk_score']}/10 → {features['risk_level']} Risk

Clinical Timeline:
{records_summary}

Retrieved Similar Context:
{context_text}

Respond in this EXACT JSON format (no markdown):
{{
  "riskLevel": "{features['risk_level']}",
  "detectedPattern": "<one sentence describing the dominant clinical pattern>",
  "actionPlan": "<2-3 sentences: specific evidence-based interventions>"
}}"""

    try:
        resp = _get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a clinical decision support AI. Always respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=300,
            temperature=0.2,
        )
        import json
        raw = resp.choices[0].message.content.strip()
        result = json.loads(raw)
        result["risk_score"] = features["risk_score"]
        logger.info(f"Intervention: risk={result.get('riskLevel')}")
    except Exception as e:
        logger.error(f"Intervention node failed: {e}")
        result = {
            "riskLevel": features["risk_level"],
            "detectedPattern": f"Risk score {features['risk_score']}/10 based on vitals.",
            "actionPlan": "Review medication regimen and schedule follow-up within 4 weeks.",
            "risk_score": features["risk_score"],
        }

    return {**state, "intervention_result": result}
