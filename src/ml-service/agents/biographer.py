"""
agents/biographer.py
--------------------
Biographer node: synthesises a structured clinical narrative for a patient
using filtered records + semantically retrieved context via Groq LLaMA-3.
"""

import os
import logging
from groq import Groq
from .state import NalamState, LANG_INSTRUCTION

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
    lang     = state.get("lang", "en")
    lang_instr = LANG_INSTRUCTION.get(lang, "")

    # ── Build records summary ─────────────────────────────────────────────────
    records_text = "\n".join([
        f"  [{r.get('date','')}] {r.get('type','Visit')} — {r.get('diagnosis','')}"
        f" | Labs: {r.get('lab_results','N/A')}"
        f"{' | Notes: ' + r.get('notes','')[:150] if r.get('notes') else ''}"
        for r in records
    ]) or "No records available."

    context_text = "\n".join([f"  • {c}" for c in context[:4]]) if context else "None."

    if lang == "ta":
        format_instruction = """
**🏥 முக்கிய நோய்கள் & நோய் கண்டறிதல்**
• [புள்ளி விவரம்]

**📈 நோய் முன்னேற்றம்**
• [புள்ளி விவரம்]

**🔬 முக்கிய ஆய்வக கண்டுபிடிப்புகள்**
• [புள்ளி விவரம்]

**⚠️ செயலில் உள்ள மருத்துவ ஆபத்துகள்**
• [புள்ளி விவரம்]

**💡 மருத்துவ பரிந்துரைகள்**
• [புள்ளி விவரம்]"""
    else:
        format_instruction = """
**🏥 Chief Concerns & Diagnoses**
• [Bullet point]

**📈 Disease Progression**
• [Bullet point]

**🔬 Key Laboratory Findings**
• [Bullet point]

**⚠️ Active Clinical Risks**
• [Bullet point]

**💡 Clinical Recommendations**
• [Bullet point]"""

    prompt = f"""You are a clinical AI biographer synthesising a patient's longitudinal health history for a treating clinician.
{lang_instr}

Patient: {patient.get('name', 'Anonymous')} | Gender: {patient.get('gender', '')} | DOB: {patient.get('dob', patient.get('age_group', ''))}
Allergies: {patient.get('allergies', 'None')} | Blood Type: {patient.get('blood_type', 'Unknown')}

Medical Timeline ({len(records)} records):
{records_text}

Semantically Retrieved Context (top-5 similar records):
{context_text}

Write a structured clinical biography using the following exact format (use bold text for section headers instead of markdown hashes):
{format_instruction}

Be extremely concise, evidence-based, use short bullet points, and keep the total output under 200 words. Do NOT use any ### headers."""

    system_msg = "You are a clinical AI that writes precise, structured patient biographies for healthcare providers."
    if lang == "ta":
        system_msg += " Always respond entirely in Tamil (தமிழ்) language."

    try:
        resp = _get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_msg},
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
