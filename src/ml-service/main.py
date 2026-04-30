"""
main.py — nalam.ai ML Service (FastAPI)
----------------------------------------
Endpoints:
  GET  /health              → liveness probe
  POST /vectorize           → index a patient's records into ChromaDB
  POST /graph/context       → context graph (guardrails→retriever→biographer)
  POST /graph/intervention  → intervention graph
  POST /graph/simulate      → simulation graph (twin)

Legacy endpoints kept for backward compat:
  POST /predict             → ML effectiveness score (direct, no graph)
  POST /intervention        → direct intervention (no graph)
"""

import os
import logging
import time
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("nalam.ml")

# ── Import LangGraph compiled graphs ─────────────────────────────────────────
from agents.graph import context_graph, intervention_graph, simulation_graph
from vectorstore.chroma_store import upsert_records, get_collection

app = FastAPI(title="nalam.ai ML Service", version="2.0.0")


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
        "service": "nalam.ai ML Service v2",
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
    """Run simulation graph: guardrails → retriever → twin."""
    t0 = time.time()
    initial_state = {
        "patient_id":       req.patient_id,
        "role":             req.role,
        "intervention_text": req.intervention,
        "patient_raw":      req.patient,
        "records_raw":      req.records,
        "guardrail_log":    [],
        "errors":           [],
    }
    result = simulation_graph.invoke(initial_state)
    sim = result.get("simulation_result", {})
    return {
        "treatmentDecision":        sim.get("treatmentDecision", ""),
        "riskPrediction":           sim.get("riskPrediction", ""),
        "personalizedCare":         sim.get("personalizedCare", ""),
        "effectiveness_probability": sim.get("effectiveness_probability", 0),
        "bp_trajectory":            sim.get("bp_trajectory", []),
        "guardrail_log":            result.get("guardrail_log", []),
        "errors":                   result.get("errors", []),
        "duration_ms":              round((time.time() - t0) * 1000),
    }
