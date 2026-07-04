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
from datetime import datetime, timedelta
from groq import Groq
from .state import NalamState, LANG_INSTRUCTION

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


def _filter_recent_records(records: list, months: int = 6) -> list:
    """Return only records from the last `months` months that have lab data."""
    cutoff = datetime.now() - timedelta(days=months * 30)
    recent = []
    for r in records:
        try:
            record_date = datetime.strptime(r.get("date", ""), "%Y-%m-%d")
            if record_date >= cutoff:
                recent.append(r)
        except (ValueError, TypeError):
            pass  # skip records with unparseable dates
    # Fallback: if no recent records, use the 3 most recent overall
    if not recent and records:
        sorted_records = sorted(
            [r for r in records if r.get("date")],
            key=lambda x: x.get("date", ""),
            reverse=True
        )
        recent = sorted_records[:3]
    return recent


def intervention_node(state: NalamState) -> NalamState:
    if state.get("guardrail_denied"):
        return {**state, "intervention_result": {"error": "Access denied by guardrails."}}

    patient  = state.get("patient_filtered", state.get("patient_raw", {}))
    all_records  = state.get("records_filtered", [])
    records  = _filter_recent_records(all_records)  # Only recent records
    context  = state.get("retrieved_context", [])
    lang     = state.get("lang", "en")
    lang_instr = LANG_INSTRUCTION.get(lang, "")

    features = _extract_features(patient, records)

    records_summary = "\n".join([
        f"  [{r.get('date','')}] {r.get('diagnosis','')} | {r.get('lab_results','')}"
        for r in records
    ]) or "No records."
    context_text = "\n".join([f"  • {c}" for c in context[:3]]) if context else "None."

    if lang == "ta":
        risk_label = {"High": "அதிகம்", "Medium": "நடுத்தரம்", "Low": "குறைவு"}.get(features["risk_level"], features["risk_level"])
        json_format = f"""{{"riskLevel": "{features['risk_level']}", "detectedPattern": "<ஒரு வாக்கியத்தில் முதன்மையான மருத்துவ வடிவத்தை விவரிக்கவும்>", "actionPlan": "<2-3 வாக்கியங்கள்: குறிப்பிட்ட சான்று அடிப்படையிலான தலையீடுகள்>"}}"""
        system_msg = "நீங்கள் ஒரு மருத்துவ முடிவு ஆதரவு AI. எப்போதும் செல்லுபடியான JSON மட்டுமே திரும்பவும். உங்கள் முழு பதிலும் தமிழில் இருக்க வேண்டும்."
    else:
        json_format = f"""{{"riskLevel": "{features['risk_level']}", "detectedPattern": "<one sentence describing the dominant clinical pattern>", "actionPlan": "<2-3 sentences: specific evidence-based interventions>"}}"""
        system_msg = "You are a clinical decision support AI. Always respond with valid JSON only."

    prompt = f"""You are a clinical AI specialising in preventive cardiology and chronic disease management.
{lang_instr}

Patient features:
  Age: {features['age']} | BP: {features['systolic']}/{features['diastolic']} mmHg
  HbA1c: {features['hba1c']}% | eGFR: {features['egfr']} ml/min/1.73m²
  Computed Risk Score: {features['risk_score']}/10 → {features['risk_level']} Risk

Clinical Timeline:
{records_summary}

Retrieved Similar Context:
{context_text}

Respond in this EXACT JSON format (no markdown):
{json_format}"""

    try:
        resp = _get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt},
            ],
            max_tokens=300,
            temperature=0.2,
        )
        import json
        raw = resp.choices[0].message.content.strip()
        # Strip markdown code fences if present
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(cleaned)
        result["risk_score"] = features["risk_score"]
        result["vitals"] = {
            "systolic": features["systolic"],
            "diastolic": features["diastolic"],
            "hba1c": features["hba1c"],
            "egfr": features["egfr"],
            "age": features["age"],
        }
        logger.info(f"Intervention: risk={result.get('riskLevel')}")
    except Exception as e:
        logger.error(f"Intervention node failed: {e}")
        if lang == "ta":
            result = {
                "riskLevel": features["risk_level"],
                "detectedPattern": f"உயிர்ச்சக்தி அளவுகளின் அடிப்படையில் ஆபத்து மதிப்பெண் {features['risk_score']}/10.",
                "actionPlan": "மருந்து முறையை மதிப்பாய்வு செய்து 4 வாரங்களுக்குள் தொடர்நடவடிக்கை திட்டமிடவும்.",
                "risk_score": features["risk_score"],
            }
        else:
            result = {
                "riskLevel": features["risk_level"],
                "detectedPattern": f"Risk score {features['risk_score']}/10 based on vitals.",
                "actionPlan": "Review medication regimen and schedule follow-up within 4 weeks.",
                "risk_score": features["risk_score"],
                "vitals": {
                    "systolic": features["systolic"],
                    "diastolic": features["diastolic"],
                    "hba1c": features["hba1c"],
                    "egfr": features["egfr"],
                    "age": features["age"],
                },
            }

    return {**state, "intervention_result": result}
