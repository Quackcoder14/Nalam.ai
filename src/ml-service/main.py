"""
main.py — nalam.ai ML Service (FastAPI)
----------------------------------------
Endpoints:
  GET  /health              → liveness probe
  POST /vectorize           → index a patient's records into ChromaDB
  POST /graph/context       → context graph (guardrails→retriever→biographer)
  POST /graph/intervention  → intervention graph
  POST /graph/simulate      → simulation graph (twin)
  POST /anomaly/detect      → real-time vital-signs anomaly detection [NEW]
  POST /xai/explain         → feature importance explanation for vitals [NEW]

Legacy endpoints kept for backward compat:
  POST /predict             → ML effectiveness score (direct, no graph)
  POST /intervention        → direct intervention (no graph)
"""

import os
import logging
import time
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Resolve the repo root (two levels up from src/ml-service/main.py)
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_REPO_ROOT / ".env")          # base vars (DATABASE_URL, ENCRYPTION_KEY)
load_dotenv(_REPO_ROOT / ".env.local", override=True)  # local overrides incl. GROQ_API_KEY
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("nalam.ml")

# ── Import LangGraph compiled graphs ─────────────────────────────────────────
from agents.graph import context_graph, intervention_graph, simulation_graph
from vectorstore.chroma_store import upsert_records, get_collection

# ── Import new modules ────────────────────────────────────────────────────────
from anomaly.detector import get_detector
from xai.explainer import explain_vitals

app = FastAPI(title="nalam.ai ML Service", version="2.1.0")

# Allow Next.js dev server to call the ML service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class PatientPayload(BaseModel):
    patient: Dict[str, Any]
    records: List[Dict[str, Any]]

class ContextRequest(BaseModel):
    patient_id: str
    role: str = "specialist"
    patient: Dict[str, Any]
    records: List[Dict[str, Any]]

class InterventionRequest(BaseModel):
    patient_id: str
    role: str = "specialist"
    patient: Dict[str, Any]
    records: List[Dict[str, Any]]

class SimulationRequest(BaseModel):
    patient_id: str
    role: str = "specialist"
    patient: Dict[str, Any]
    records: List[Dict[str, Any]]
    intervention: str

class VectorizeRequest(BaseModel):
    patient_id: str
    records: List[Dict[str, Any]]

class VitalsPayload(BaseModel):
    """Real-time vital signs for anomaly detection."""
    heart_rate:   Optional[float] = None
    systolic_bp:  Optional[float] = None
    diastolic_bp: Optional[float] = None
    spo2:         Optional[float] = None
    temperature:  Optional[float] = None
    glucose:      Optional[float] = None
    patient_id:   Optional[str]   = None  # for audit purposes

class XAIRequest(BaseModel):
    """Vital signs + optional extra features for XAI explanation."""
    heart_rate:       Optional[float] = None
    systolic_bp:      Optional[float] = None
    diastolic_bp:     Optional[float] = None
    spo2:             Optional[float] = None
    temperature:      Optional[float] = None
    glucose:          Optional[float] = None
    age:              Optional[float] = None
    bmi:              Optional[float] = None
    cholesterol:      Optional[float] = None
    num_conditions:   Optional[int]   = None
    num_records:      Optional[int]   = None
    has_hypertension: Optional[int]   = None
    has_diabetes:     Optional[int]   = None
    has_cad:          Optional[int]   = None


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    try:
        col = get_collection()
        chroma_count = col.count()
        chroma_ok = True
    except Exception as e:
        chroma_ok = False
        chroma_count = -1
    return {
        "status": "ok",
        "service": "nalam.ai ML Service v2.1",
        "chroma": {"connected": chroma_ok, "total_vectors": chroma_count},
    }


# ── Vectorize ─────────────────────────────────────────────────────────────────

@app.post("/vectorize")
def vectorize(req: VectorizeRequest):
    """Index (or re-index) a patient's records into ChromaDB."""
    t0 = time.time()
    try:
        n = upsert_records(req.patient_id, req.records)
        return {
            "success": True,
            "patient_id": req.patient_id,
            "records_indexed": n,
            "duration_ms": round((time.time() - t0) * 1000),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Anomaly Detection ─────────────────────────────────────────────────────────

@app.post("/anomaly/detect")
def anomaly_detect(req: VitalsPayload):
    """
    Detect anomalies in real-time vital signs.
    Combines IsolationForest + clinical rule engine.
    """
    t0 = time.time()
    try:
        vitals = req.model_dump(exclude={"patient_id"}, exclude_none=True)
        detector = get_detector()
        result = detector.detect(vitals)
        result["duration_ms"] = round((time.time() - t0) * 1000)
        result["patient_id"] = req.patient_id
        logger.info(
            "Anomaly check patient=%s is_anomaly=%s severity=%s flags=%d",
            req.patient_id, result["is_anomaly"], result["severity"], len(result["flags"])
        )
        return result
    except Exception as e:
        logger.error("Anomaly detection error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── XAI Explain ───────────────────────────────────────────────────────────────

@app.post("/xai/explain")
def xai_explain(req: XAIRequest):
    """
    Return feature importance explanations for a set of vitals/features.
    Uses rule-based deviation scoring (SHAP-ready extension point).
    """
    t0 = time.time()
    try:
        features = req.model_dump(exclude_none=True)
        explanations = explain_vitals(features)
        return {
            "explanations": explanations,
            "top_driver":   explanations[0]["label"] if explanations else None,
            "duration_ms":  round((time.time() - t0) * 1000),
        }
    except Exception as e:
        logger.error("XAI explanation error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── LangGraph Endpoints ───────────────────────────────────────────────────────

@app.post("/graph/context")
def graph_context(req: ContextRequest):
    """Run context graph: guardrails → retriever → biographer."""
    t0 = time.time()
    initial_state = {
        "patient_id": req.patient_id,
        "role": req.role,
        "patient_raw": req.patient,
        "records_raw": req.records,
        "guardrail_log": [],
        "errors": [],
    }
    result = context_graph.invoke(initial_state)
    return {
        "biography":      result.get("biography", ""),
        "guardrail_log":  result.get("guardrail_log", []),
        "errors":         result.get("errors", []),
        "records_shared": len(result.get("records_filtered", [])),
        "context_chunks": len(result.get("retrieved_context", [])),
        "duration_ms":    round((time.time() - t0) * 1000),
    }


@app.post("/graph/intervention")
def graph_intervention(req: InterventionRequest):
    """Run intervention graph: guardrails → retriever → intervention."""
    t0 = time.time()
    initial_state = {
        "patient_id": req.patient_id,
        "role": req.role,
        "patient_raw": req.patient,
        "records_raw": req.records,
        "guardrail_log": [],
        "errors": [],
    }
    result = intervention_graph.invoke(initial_state)
    return {
        "intervention":   result.get("intervention_result", {}),
        "guardrail_log":  result.get("guardrail_log", []),
        "errors":         result.get("errors", []),
        "records_shared": len(result.get("records_filtered", [])),
        "duration_ms":    round((time.time() - t0) * 1000),
    }


@app.post("/graph/simulate")
def graph_simulate(req: SimulationRequest):
    """Run simulation graph: guardrails → retriever → twin. Enriched with XAI."""
    t0 = time.time()
    initial_state = {
        "patient_id":        req.patient_id,
        "role":              req.role,
        "intervention_text": req.intervention,
        "patient_raw":       req.patient,
        "records_raw":       req.records,
        "guardrail_log":     [],
        "errors":            [],
    }
    result = simulation_graph.invoke(initial_state)
    sim = result.get("simulation_result", {})

    # ── XAI enrichment ────────────────────────────────────────────────────────
    xai_features: List[Dict[str, Any]] = []
    try:
        vitals_for_xai: Dict[str, Any] = {}
        for rec in req.records[:5]:
            lab = rec.get("lab_results", "") or ""
            bp_match = re.search(r'BP[:\s]*(\d+)/(\d+)', lab, re.I)
            if bp_match:
                vitals_for_xai["systolic_bp"]  = float(bp_match.group(1))
                vitals_for_xai["diastolic_bp"] = float(bp_match.group(2))
            hr_match = re.search(r'HR[:\s]*(\d+)', lab, re.I)
            if hr_match:
                vitals_for_xai["heart_rate"] = float(hr_match.group(1))
            spo2_match = re.search(r'SpO2[:\s]*(\d+)', lab, re.I)
            if spo2_match:
                vitals_for_xai["spo2"] = float(spo2_match.group(1))

        xai_features = explain_vitals(vitals_for_xai) if vitals_for_xai else []
    except Exception as xai_err:
        logger.warning("XAI enrichment failed: %s", xai_err)

    return {
        "treatmentDecision":         sim.get("treatmentDecision", ""),
        "riskPrediction":            sim.get("riskPrediction", ""),
        "personalizedCare":          sim.get("personalizedCare", ""),
        "effectiveness_probability": sim.get("effectiveness_probability", 0),
        "guardrail_log":            result.get("guardrail_log", []),
        "errors":                   result.get("errors", []),
        "duration_ms":              round((time.time() - t0) * 1000),
    }
