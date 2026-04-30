"""
agents/guardrails.py
--------------------
Guardrails node: enforces consent checks and role-based data limits
BEFORE any other agent sees patient data.

Role limits:
  emergency  → consent_emergency check → last 3 records → date/diagnosis/lab_results only
  specialist → consent_specialist check → last 10 records → all fields
  research   → consent_research check  → last 15 records → full PII strip
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, List

from .state import NalamState

logger = logging.getLogger(__name__)

# Max records exposed per role
ROLE_RECORD_LIMITS: Dict[str, int] = {
    "emergency": 3,
    "specialist": 10,
    "research": 15,
}

# Allowed record fields per role (None = all fields)
ROLE_ALLOWED_FIELDS: Dict[str, Any] = {
    "emergency": {"date", "diagnosis", "lab_results", "type"},
    "specialist": None,
    "research": {"date", "type", "diagnosis", "lab_results"},  # notes stripped (may contain PII)
}

# Consent flag per role
ROLE_CONSENT_KEY: Dict[str, str] = {
    "emergency": "consent_emergency",
    "specialist": "consent_specialist",
    "research": "consent_research",
}


def _age_group(dob: str) -> str:
    if not dob:
        return "Unknown"
    try:
        age = datetime.now().year - int(dob.split("-")[0])
        if age < 30:   return "18-29"
        if age < 45:   return "30-44"
        if age < 60:   return "45-59"
        return "60+"
    except Exception:
        return "Unknown"


def guardrails_node(state: NalamState) -> NalamState:
    role            = state.get("role", "specialist")
    patient_raw     = state.get("patient_raw", {})
    records_raw     = state.get("records_raw", [])
    errors          = list(state.get("errors", []))
    guardrail_log   = list(state.get("guardrail_log", []))
    ts              = datetime.now(timezone.utc).isoformat()

    consent_key = ROLE_CONSENT_KEY.get(role, "consent_specialist")

    # ── 1. Consent check ───────────────────────────────────────────────────────
    patient_consent = str(patient_raw.get(consent_key, "false")).lower()
    if patient_consent not in ("true", "1", "yes"):
        msg = f"Access denied: patient has not granted '{role}' consent."
        errors.append(msg)
        guardrail_log.append({
            "event": "CONSENT_DENIED",
            "role": role,
            "consent_key": consent_key,
            "timestamp": ts,
        })
        logger.warning(msg)
        return {
            **state,
            "patient_filtered": {},
            "records_filtered": [],
            "guardrail_denied": True,
            "guardrail_log": guardrail_log,
            "errors": errors,
        }

    # ── 2. Record volume limit ─────────────────────────────────────────────────
    limit = ROLE_RECORD_LIMITS.get(role, 10)
    sorted_records = sorted(records_raw, key=lambda r: r.get("date", ""), reverse=True)
    limited = sorted_records[:limit]

    # ── 3. Field-level filtering ───────────────────────────────────────────────
    allowed = ROLE_ALLOWED_FIELDS.get(role)
    if allowed:
        limited = [{k: v for k, v in r.items() if k in allowed} for r in limited]

    # ── 4. PII stripping for research ─────────────────────────────────────────
    if role == "research":
        patient_filtered: Dict[str, Any] = {
            "id":          "ANON",
            "name":        "Anonymous",
            "gender":      patient_raw.get("gender", ""),
            "age_group":   _age_group(patient_raw.get("dob", "")),
            "blood_type":  patient_raw.get("blood_type", ""),
            "allergies":   patient_raw.get("allergies", ""),
        }
    else:
        patient_filtered = dict(patient_raw)

    guardrail_log.append({
        "event": "ACCESS_GRANTED",
        "role": role,
        "records_available": len(records_raw),
        "records_shared": len(limited),
        "fields_restricted": list(allowed) if allowed else "none",
        "pii_stripped": role == "research",
        "timestamp": ts,
    })
    logger.info(
        f"Guardrails: role={role}, {len(records_raw)} → {len(limited)} records, "
        f"pii_strip={role == 'research'}"
    )

    return {
        **state,
        "patient_filtered": patient_filtered,
        "records_filtered": limited,
        "guardrail_denied": False,
        "guardrail_log": guardrail_log,
        "errors": errors,
    }
