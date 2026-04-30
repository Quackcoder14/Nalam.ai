"""
agents/biographer.py
--------------------
Biographer node: synthesises a structured clinical narrative for a patient
using filtered records + semantically retrieved context via Groq LLaMA-3.
"""

import os
import logging
from groq import Groq
from .state import NalamState

logger = logging.getLogger(__name__)
_groq = None


def _get_groq() -> Groq:
    global _groq
    if _groq is None:
        _groq = Groq()
    return _groq


def biographer_node(state: NalamState) -> NalamState:
    if state.get("guardrail_denied") or state.get("errors"):
        return {**state, "biography": ""}

    patient  = state.get("patient_filtered", state.get("patient_raw", {}))
    records  = state.get("records_filtered", [])
    context  = state.get("retrieved_context", [])

    # ── Build records summary ─────────────────────────────────────────────────
    records_text = "\n".join([
        f"  [{r.get('date','')}] {r.get('type','Visit')} — {r.get('diagnosis','')}"
        f" | Labs: {r.get('lab_results','N/A')}"
        f"{' | Notes: ' + r.get('notes','')[:150] if r.get('notes') else ''}"
        for r in records
    ]) or "No records available."

    context_text = "\n".join([f"  • {c}" for c in context[:4]]) if context else "None."

    prompt = f"""You are a clinical AI biographer synthesising a patient's longitudinal health history for a treating clinician.

Patient: {patient.get('name', 'Anonymous')} | Gender: {patient.get('gender', '')} | DOB: {patient.get('dob', patient.get('age_group', ''))}
Allergies: {patient.get('allergies', 'None')} | Blood Type: {patient.get('blood_type', 'Unknown')}

Medical Timeline ({len(records)} records):
{records_text}

Semantically Retrieved Context (top-5 similar records):
{context_text}

Write a structured clinical biography covering:
1. Chief concerns and primary diagnoses
2. Disease progression and trends
3. Key laboratory findings and trajectories
4. Active clinical risk factors
5. Clinical recommendations for the receiving provider

Be precise, evidence-based, and under 500 words."""

    try:
        resp = _get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a clinical AI that writes precise, structured patient biographies for healthcare providers."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=700,
            temperature=0.25,
        )
        biography = resp.choices[0].message.content.strip()
        logger.info(f"Biographer: generated {len(biography)} chars.")
    except Exception as e:
        logger.error(f"Biographer: Groq call failed — {e}")
        biography = f"Biography unavailable: {str(e)}"

    return {**state, "biography": biography}
