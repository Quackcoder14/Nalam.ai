from typing import TypedDict, List, Dict, Any


class NalamState(TypedDict, total=False):
    # ── Inputs ───────────────────────────────────────────────────────────────
    patient_id: str
    role: str               # "emergency" | "specialist" | "research"
    intervention_text: str  # only for simulation graph
    lang: str               # "en" | "ta" — output language for Groq narrative

    # ── Raw data (from caller) ───────────────────────────────────────────────
    patient_raw: Dict[str, Any]
    records_raw: List[Dict[str, Any]]

    # ── After guardrails node ────────────────────────────────────────────────
    patient_filtered: Dict[str, Any]
    records_filtered: List[Dict[str, Any]]
    guardrail_log: List[Dict[str, Any]]
    guardrail_denied: bool

    # ── After retriever node ─────────────────────────────────────────────────
    retrieved_context: List[str]
    retrieved_metadata: List[Dict[str, Any]]

    # ── Agent outputs ────────────────────────────────────────────────────────
    biography: str
    intervention_result: Dict[str, Any]
    simulation_result: Dict[str, Any]

    # ── Errors ───────────────────────────────────────────────────────────────
    errors: List[str]


LANG_INSTRUCTION = {
    "ta": (
        "IMPORTANT: You MUST write your entire response in Tamil (தமிழ்) language only. "
        "Every word, sentence, bullet point, and label must be in Tamil script. "
        "Do not use any English words in the narrative text."
    ),
    "en": "",
}
