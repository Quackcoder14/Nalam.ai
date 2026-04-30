"""
agents/twin.py
--------------
Digital Twin Simulation node: uses a trained sklearn RandomForest model to
predict medication effectiveness score, then uses Groq to generate a
precision medicine narrative with 3-year BP trajectory projection.
"""

import os
import re
import json
import logging
import numpy as np
from groq import Groq
from sklearn.ensemble import RandomForestClassifier

from .state import NalamState

logger = logging.getLogger(__name__)
_groq = None
_model = None


def _get_groq() -> Groq:
    global _groq
    if _groq is None:
        _groq = Groq()
    return _groq


def _get_model() -> RandomForestClassifier:
    """Return a fitted RandomForest (trained inline with synthetic clinical data)."""
    global _model
    if _model is not None:
        return _model

    rng = np.random.RandomState(42)
    n = 400
    # Features: [age, systolic, diastolic, hba1c, egfr, n_meds, is_positive_drug]
    X = np.column_stack([
        rng.randint(30, 80, n),      # age
        rng.randint(120, 180, n),    # systolic
        rng.randint(70, 110, n),     # diastolic
        rng.uniform(5.0, 10.0, n),   # hba1c
        rng.randint(40, 100, n),     # egfr
        rng.randint(1, 8, n),        # n_meds
        rng.randint(0, 2, n),        # is_positive_drug
    ])
    # Effectiveness: 1 if systolic reducible by drug, else 0
    y = ((X[:, 1] > 140) & (X[:, 6] == 1)).astype(int)

    _model = RandomForestClassifier(n_estimators=100, random_state=42)
    _model.fit(X, y)
    logger.info("Twin simulation RF model trained.")
    return _model


def _extract_features(patient: dict, records: list) -> dict:
    age, systolic, diastolic, hba1c, egfr = 50, 130, 85, 5.7, 90
    try:
        dob = patient.get("dob", "")
        if dob:
            age = 2024 - int(dob.split("-")[0])
    except Exception:
        pass
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
    return {"age": age, "systolic": systolic, "diastolic": diastolic,
            "hba1c": hba1c, "egfr": egfr}


def _build_bp_trajectory(systolic: int, intervention: str, effective: bool) -> list:
    slope = -4 if effective else -1
    return [
        {"year": "Year 1", "predicted_systolic": systolic + slope},
        {"year": "Year 2", "predicted_systolic": systolic + slope * 2},
        {"year": "Year 3", "predicted_systolic": systolic + slope * 3},
    ]


POSITIVE_DRUGS = {"amlodipine", "lisinopril", "losartan", "ramipril", "bisoprolol",
                  "carvedilol", "metoprolol", "telmisartan", "olmesartan", "valsartan"}


def twin_node(state: NalamState) -> NalamState:
    if state.get("guardrail_denied"):
        return {**state, "simulation_result": {"error": "Access denied by guardrails."}}

    patient      = state.get("patient_filtered", state.get("patient_raw", {}))
    records      = state.get("records_filtered", [])
    intervention = state.get("intervention_text", "")
    context      = state.get("retrieved_context", [])

    feats = _extract_features(patient, records)
    is_positive = int(any(d in intervention.lower() for d in POSITIVE_DRUGS))

    model = _get_model()
    X = np.array([[
        feats["age"], feats["systolic"], feats["diastolic"],
        feats["hba1c"], feats["egfr"], len(records), is_positive,
    ]])
    effectiveness_prob = float(model.predict_proba(X)[0][1])
    effective = effectiveness_prob > 0.5
    trajectory = _build_bp_trajectory(feats["systolic"], intervention, effective)
    context_text = "\n".join([f"  • {c}" for c in context[:3]]) if context else "None."

    prompt = f"""You are a precision medicine AI. A clinician is considering the following intervention:

Intervention: {intervention}
Patient: Age {feats['age']}, BP {feats['systolic']}/{feats['diastolic']} mmHg, HbA1c {feats['hba1c']}%, eGFR {feats['egfr']}
ML Effectiveness Score: {effectiveness_prob:.0%}
Predicted BP Trajectory: {trajectory[0]['predicted_systolic']} → {trajectory[1]['predicted_systolic']} → {trajectory[2]['predicted_systolic']} mmHg

Similar Patient Context:
{context_text}

Respond in this EXACT JSON format (no markdown). Provide detailed, comprehensive, and well-reasoned clinical explanations for each field (at least 3-4 sentences per field):
{{
  "treatmentDecision": "<detailed evidence-based recommendation for or against this intervention>",
  "riskPrediction": "<detailed cardiovascular risk projection over 3-5 years with this intervention>",
  "personalizedCare": "<comprehensive monitoring plan, contraindications, and follow-up schedule>"
}}"""

    try:
        resp = _get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a precision medicine AI. Always respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=1500,
            temperature=0.2,
        )
        narratives = json.loads(resp.choices[0].message.content.strip())
    except Exception as e:
        logger.error(f"Twin node Groq failed: {e}")
        narratives = {
            "treatmentDecision": f"ML model rates {intervention} effectiveness at {effectiveness_prob:.0%}.",
            "riskPrediction": "Cardiovascular risk projection pending full clinical evaluation.",
            "personalizedCare": "Schedule follow-up in 4 weeks to assess response.",
        }

    result = {
        **narratives,
        "effectiveness_probability": effectiveness_prob,
        "bp_trajectory": trajectory,
        "intervention": intervention,
    }
    logger.info(f"Twin: {intervention} → effectiveness={effectiveness_prob:.0%}")
    return {**state, "simulation_result": result}
