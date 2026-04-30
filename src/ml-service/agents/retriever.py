"""
agents/retriever.py
-------------------
Retriever node: auto-indexes patient records into ChromaDB, then performs
a semantic search to fetch the most relevant context for the active query.
This enriches downstream agents with retrieved clinical context (RAG).
"""

import logging
from .state import NalamState
from vectorstore.chroma_store import upsert_records, semantic_search

logger = logging.getLogger(__name__)


def retriever_node(state: NalamState) -> NalamState:
    if state.get("guardrail_denied"):
        return {**state, "retrieved_context": [], "retrieved_metadata": []}

    patient_id      = state.get("patient_id", "")
    records_raw     = state.get("records_raw", [])
    records_filtered = state.get("records_filtered", [])

    # ── 1. Upsert ALL raw records into vector store (idempotent) ──────────────
    if records_raw:
        try:
            n = upsert_records(patient_id, records_raw)
            logger.info(f"Retriever: indexed {n} records for {patient_id}.")
        except Exception as e:
            logger.warning(f"Retriever: upsert failed ({e}), continuing without indexing.")

    # ── 2. Build clinical query from filtered records ─────────────────────────
    query_parts = []
    for r in records_filtered[:3]:
        diag = r.get("diagnosis", "")
        labs = r.get("lab_results", "")
        if diag: query_parts.append(diag)
        if labs:  query_parts.append(labs)
    query = " ".join(query_parts) if query_parts else "patient clinical history"

    # ── 3. Semantic search ────────────────────────────────────────────────────
    try:
        results = semantic_search(patient_id=patient_id, query=query, n_results=5)
        docs  = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        logger.info(f"Retriever: found {len(docs)} relevant context chunks.")
    except Exception as e:
        logger.warning(f"Retriever: semantic search failed ({e}), returning empty context.")
        docs, metas = [], []

    return {
        **state,
        "retrieved_context": docs,
        "retrieved_metadata": metas,
    }
